import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/schedule — list all weeks (auto-purge >2 months)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  await prisma.weekSchedule.deleteMany({
    where: { weekEndDate: { lt: twoMonthsAgo } },
  });

  const weeks = await prisma.weekSchedule.findMany({
    orderBy: { weekStartDate: "desc" },
    include: { _count: { select: { employeeSchedules: true } } },
  });

  return NextResponse.json({ weeks });
}

// POST /api/schedule — create a new week with schedules for all active employees
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const { weekStartDate, copyFromWeekId } = await req.json();

    const start = new Date(weekStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const existing = await prisma.weekSchedule.findFirst({
      where: { weekStartDate: start },
    });
    if (existing) {
      return NextResponse.json({ error: "Week already exists" }, { status: 400 });
    }

    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["EMPLOYEE", "CO_ADMIN"] } },
      select: { id: true },
    });

    // Create week first, then schedules separately to avoid nested create issues
    const week = await prisma.weekSchedule.create({
      data: { weekStartDate: start, weekEndDate: end },
    });

    if (copyFromWeekId) {
      // Copy schedules from previous week, same day-of-week offsets
      const prevSchedules = await prisma.employeeSchedule.findMany({
        where: { weekScheduleId: copyFromWeekId },
      });
      if (prevSchedules.length > 0) {
        const prevWeek = await prisma.weekSchedule.findUnique({ where: { id: copyFromWeekId } });
        const prevStart = prevWeek ? new Date(prevWeek.weekStartDate) : null;
        const scheduleData = prevSchedules.map((s) => {
          // Calculate same day-of-week offset for new week
          const dayOffset = prevStart
            ? Math.round((new Date(s.date).getTime() - prevStart.getTime()) / 86400000)
            : 0;
          const newDate = new Date(start);
          newDate.setDate(newDate.getDate() + dayOffset);
          newDate.setHours(0, 0, 0, 0);
          return {
            weekScheduleId: week.id,
            userId: s.userId,
            date: newDate,
            scheduledStart: s.scheduledStart,
            scheduledEnd: s.scheduledEnd,
            isDayOff: s.isDayOff,
            notes: s.notes,
            // clockIn/clockOut intentionally not copied
          };
        });
        await prisma.employeeSchedule.createMany({ data: scheduleData });
      }
    } else if (employees.length > 0) {
      const scheduleData = employees.flatMap((emp) =>
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date(start);
          date.setDate(date.getDate() + i);
          date.setHours(0, 0, 0, 0);
          return { weekScheduleId: week.id, userId: emp.id, date };
        })
      );
      await prisma.employeeSchedule.createMany({ data: scheduleData });
    }

    const fullWeek = await prisma.weekSchedule.findUnique({
      where: { id: week.id },
      include: {
        employeeSchedules: {
          include: { user: { select: { id: true, name: true } }, wageOverrides: true },
        },
      },
    });

    return NextResponse.json({ week: fullWeek }, { status: 201 });
  } catch (e) {
    console.error("[schedule POST]", e);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
