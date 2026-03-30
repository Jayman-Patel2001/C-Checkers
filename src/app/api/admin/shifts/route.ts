import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/shifts - Get all shifts with full productivity breakdown
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status"); // "active" | "ended" | undefined (all)

  // Auto-purge shifts older than 7 days (keep active shifts regardless)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.shift.deleteMany({
    where: {
      startTime: { lt: sevenDaysAgo },
      endTime: { not: null }, // never delete active shifts
    },
  });

  // Only fetch shifts from the last 7 days
  const where: Record<string, unknown> = {
    startTime: { gte: sevenDaysAgo },
  };
  if (userId) where.userId = userId;
  if (status === "active") where.endTime = null;
  if (status === "ended") where.endTime = { not: null };

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      taskEntries: {
        include: {
          review: { select: { status: true } },
        },
      },
    },
    orderBy: { startTime: "desc" },
    take: 100,
  });

  // Compute stats for each shift
  const shiftsWithStats = shifts.map((shift) => {
    let workSeconds = 0;
    let personalSeconds = 0;
    const now = Date.now();

    let rejectedWorkSeconds = 0;

    for (const task of shift.taskEntries) {
      let taskTime = task.totalActiveTime;
      // Add live interval if shift is still active and task is running
      if (!shift.endTime && task.status === "ACTIVE" && task.activeIntervalStart) {
        taskTime += Math.floor(
          (now - new Date(task.activeIntervalStart).getTime()) / 1000
        );
      }
      if (task.category === "WORK") {
        if (task.review?.status === "REJECTED") {
          rejectedWorkSeconds += taskTime;
        } else {
          workSeconds += taskTime;
        }
      } else {
        personalSeconds += taskTime;
      }
    }

    const shiftDurationSeconds = shift.endTime
      ? Math.floor(
          (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 1000
        )
      : Math.floor((now - new Date(shift.startTime).getTime()) / 1000);

    const totalTrackedSeconds = workSeconds + personalSeconds + rejectedWorkSeconds;
    // Idle = time in shift where no task was running at all
    const idleSeconds = Math.max(0, shiftDurationSeconds - totalTrackedSeconds);
    // Wasted = personal breaks + idle time + rejected work
    const wastedSeconds = personalSeconds + idleSeconds + rejectedWorkSeconds;

    // Percentages against full shift duration
    const workPct = shiftDurationSeconds > 0 ? Math.round((workSeconds / shiftDurationSeconds) * 100) : 0;
    const personalPct = shiftDurationSeconds > 0 ? Math.round((personalSeconds / shiftDurationSeconds) * 100) : 0;
    const idlePct = shiftDurationSeconds > 0 ? Math.round((idleSeconds / shiftDurationSeconds) * 100) : 0;
    const wastedPct = shiftDurationSeconds > 0 ? Math.round((wastedSeconds / shiftDurationSeconds) * 100) : 0;

    const taskBreakdown = shift.taskEntries.map((t) => {
      let taskTime = t.totalActiveTime;
      if (!shift.endTime && t.status === "ACTIVE" && t.activeIntervalStart) {
        taskTime += Math.floor((now - new Date(t.activeIntervalStart).getTime()) / 1000);
      }
      return {
        id: t.id,
        name: t.name,
        category: t.category,
        status: t.status,
        isCustom: t.isCustom,
        totalActiveTime: taskTime,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        reviewStatus: t.review?.status ?? null,
      };
    });

    return {
      id: shift.id,
      user: shift.user,
      startTime: shift.startTime,
      endTime: shift.endTime,
      shiftDurationSeconds,
      workSeconds,
      personalSeconds,
      idleSeconds,
      rejectedWorkSeconds,
      wastedSeconds,
      totalTrackedSeconds,
      workPct,
      personalPct,
      idlePct,
      wastedPct,
      taskCount: shift.taskEntries.length,
      taskBreakdown,
    };
  });

  return NextResponse.json({ shifts: shiftsWithStats });
}
