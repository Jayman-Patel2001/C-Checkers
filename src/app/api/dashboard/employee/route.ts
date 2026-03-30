import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/employee - Get all data needed for employee dashboard
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "EMPLOYEE" && session.user.role !== "CO_ADMIN") {
    return NextResponse.json({ error: "Employee only" }, { status: 403 });
  }

  const userId = session.user.id;

  // Get active shift with all task entries
  const activeShift = await prisma.shift.findFirst({
    where: { userId, endTime: null },
    include: {
      taskEntries: {
        include: {
          taskDefinition: true,
          events: { orderBy: { timestamp: "asc" } },
          review: { include: { admin: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { startTime: "desc" },
  });

  // Get task definitions visible to this employee:
  // - Tasks with NO assignments (available to all)
  // - Tasks explicitly assigned to this employee
  const allActiveDefs = await prisma.taskDefinition.findMany({
    where: { isActive: true },
    include: {
      assignments: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  // Filter task definitions by role:
  // - EMPLOYEE: sees tasks with no assignments (global) OR explicitly assigned to them
  // - CO_ADMIN: only sees tasks explicitly assigned to them (not global unassigned tasks)
  const isCoadmin = session.user.role === "CO_ADMIN";
  const taskDefinitions = allActiveDefs
    .filter((def) =>
      isCoadmin
        ? def.assignments.some((a) => a.userId === userId)
        : def.assignments.length === 0 || def.assignments.some((a) => a.userId === userId)
    )
    .map(({ assignments: _, ...def }) => def); // remove assignments from response

  // Calculate productivity stats for active shift
  let productiveSeconds = 0;
  let personalSeconds = 0;
  let shiftDuration = 0;

  if (activeShift) {
    const now = Date.now();
    shiftDuration = Math.floor((now - new Date(activeShift.startTime).getTime()) / 1000);

    for (const task of activeShift.taskEntries) {
      let taskTime = task.totalActiveTime;
      if (task.status === "ACTIVE" && task.activeIntervalStart) {
        taskTime += Math.floor(
          (now - new Date(task.activeIntervalStart).getTime()) / 1000
        );
      }

      if (task.category === "WORK") {
        productiveSeconds += taskTime;
      } else {
        personalSeconds += taskTime;
      }
    }
  }

  // Classify tasks
  const tasks = activeShift?.taskEntries || [];
  const activeTask = tasks.find((t) => t.status === "ACTIVE") || null;
  const pausedTasks = tasks.filter((t) => t.status === "PAUSED");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
  const pendingReviewTasks = completedTasks.filter((t) => !t.review);
  const reviewedTasks = completedTasks.filter((t) => t.review);

  // When no active shift, load last completed shift for end-of-day review
  let lastShiftReview = null;
  if (!activeShift) {
    const lastShift = await prisma.shift.findFirst({
      where: { userId, endTime: { not: null } },
      include: {
        taskEntries: {
          include: {
            review: { include: { admin: { select: { id: true, name: true } } } },
          },
          orderBy: { startedAt: "asc" },
        },
      },
      orderBy: { endTime: "desc" },
    });

    if (lastShift) {
      const endMs = new Date(lastShift.endTime!).getTime();
      const startMs = new Date(lastShift.startTime).getTime();
      const durationSeconds = Math.floor((endMs - startMs) / 1000);

      let workSec = 0;
      let personalSec = 0;
      for (const t of lastShift.taskEntries) {
        if (t.category === "WORK") workSec += t.totalActiveTime;
        else personalSec += t.totalActiveTime;
      }

      lastShiftReview = {
        id: lastShift.id,
        startTime: lastShift.startTime,
        endTime: lastShift.endTime,
        durationSeconds,
        workSeconds: workSec,
        personalSeconds: personalSec,
        tasks: lastShift.taskEntries.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          totalActiveTime: t.totalActiveTime,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          review: t.review
            ? {
                status: t.review.status,
                comment: t.review.comment,
                adminName: t.review.admin.name,
                reviewedAt: t.review.reviewedAt,
              }
            : null,
        })),
      };
    }
  }

  return NextResponse.json({
    activeShift,
    activeTask,
    pausedTasks,
    completedTasks,
    pendingReviewTasks,
    reviewedTasks,
    taskDefinitions,
    productiveSeconds,
    personalSeconds,
    shiftDuration,
    lastShiftReview,
  });
}
