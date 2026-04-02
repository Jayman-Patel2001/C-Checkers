import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = await prisma.weekSchedule.findUnique({
    where: { id: params.weekId },
    include: {
      employeeSchedules: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          wageOverrides: { orderBy: { hourSlot: "asc" } },
        },
        orderBy: [{ userId: "asc" }, { date: "asc" }],
      },
      paySummaries: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  // Auto-add any new employees who don't have schedules for this week yet
  const existingUserIds = new Set(week.employeeSchedules.map((s) => s.userId));
  const allEmployees = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["EMPLOYEE", "CO_ADMIN"] } },
    select: { id: true },
  });
  const missingEmployees = allEmployees.filter((e) => !existingUserIds.has(e.id));

  if (missingEmployees.length > 0) {
    const start = new Date(week.weekStartDate);
    const newSchedules = missingEmployees.flatMap((emp) =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start);
        date.setUTCDate(date.getUTCDate() + i);
        date.setUTCHours(0, 0, 0, 0);
        return { weekScheduleId: week.id, userId: emp.id, date };
      })
    );
    await prisma.employeeSchedule.createMany({ data: newSchedules });

    // Re-fetch with new schedules included
    const refreshed = await prisma.weekSchedule.findUnique({
      where: { id: params.weekId },
      include: {
        employeeSchedules: {
          include: {
            user: { select: { id: true, name: true, role: true } },
            wageOverrides: { orderBy: { hourSlot: "asc" } },
          },
          orderBy: [{ userId: "asc" }, { date: "asc" }],
        },
        paySummaries: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    const allUserIds = Array.from(new Set(refreshed!.employeeSchedules.map((s) => s.userId)));
    const payRates = await prisma.employeePayRate.findMany({
      where: { userId: { in: allUserIds } },
      orderBy: { effectiveFrom: "desc" },
    });
    const currentRates: Record<string, number> = {};
    for (const rate of payRates) {
      if (!currentRates[rate.userId]) currentRates[rate.userId] = rate.hourlyRate;
    }
    return NextResponse.json({ week: refreshed, currentRates });
  }

  // Attach current pay rate to each unique user
  const userIds = Array.from(new Set(week.employeeSchedules.map((s) => s.userId)));
  const payRates = await prisma.employeePayRate.findMany({
    where: { userId: { in: userIds } },
    orderBy: { effectiveFrom: "desc" },
  });

  const currentRates: Record<string, number> = {};
  for (const rate of payRates) {
    if (!currentRates[rate.userId]) currentRates[rate.userId] = rate.hourlyRate;
  }

  return NextResponse.json({ week, currentRates });
}

export async function PATCH(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { visibleToEmployees } = await req.json();
  const week = await prisma.weekSchedule.update({
    where: { id: params.weekId },
    data: { visibleToEmployees },
  });
  return NextResponse.json({ week });
}

export async function DELETE(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await prisma.weekSchedule.delete({ where: { id: params.weekId } });
  return NextResponse.json({ success: true });
}
