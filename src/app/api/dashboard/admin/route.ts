import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/admin - Get admin dashboard data
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalEmployees,
    activeShiftsCount,
    pendingReviewsCount,
    todayCompletedCount,
    activeShifts,
    pendingReviewTasks,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
    prisma.shift.count({ where: { endTime: null } }),
    prisma.taskEntry.count({ where: { status: "COMPLETED", review: null } }),
    prisma.taskEntry.count({
      where: {
        status: "COMPLETED",
        completedAt: { gte: todayStart },
      },
    }),
    prisma.shift.findMany({
      where: { endTime: null },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
        taskEntries: {
          include: { taskDefinition: true, events: true, review: true },
        },
      },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
    prisma.taskEntry.findMany({
      where: { status: "COMPLETED", review: null },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        shift: true,
      },
      orderBy: { completedAt: "desc" },
      take: 50,
    }),
  ]);

  // Compute stats for each active shift
  const shiftStats = activeShifts.map((shift) => {
    let productiveSeconds = 0;
    let personalSeconds = 0;
    const nowMs = Date.now();

    for (const task of shift.taskEntries) {
      let taskTime = task.totalActiveTime;
      if (task.status === "ACTIVE" && task.activeIntervalStart) {
        taskTime += Math.floor(
          (nowMs - new Date(task.activeIntervalStart).getTime()) / 1000
        );
      }
      if (task.category === "WORK") productiveSeconds += taskTime;
      else personalSeconds += taskTime;
    }

    return {
      id: shift.id,
      user: shift.user,
      startTime: shift.startTime,
      endTime: shift.endTime,
      productiveSeconds,
      personalSeconds,
      totalTasks: shift.taskEntries.length,
      activeTask: shift.taskEntries.find((t) => t.status === "ACTIVE") || null,
    };
  });

  return NextResponse.json({
    totalEmployees,
    activeShifts: activeShiftsCount,
    pendingReviews: pendingReviewsCount,
    todayCompletedTasks: todayCompletedCount,
    recentShifts: shiftStats,
    pendingReviewTasks,
  });
}
