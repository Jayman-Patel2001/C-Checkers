import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/tasks - Create a new task entry and start it
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "EMPLOYEE" && session.user.role !== "CO_ADMIN") {
    return NextResponse.json({ error: "Only employees can create tasks" }, { status: 403 });
  }

  const body = await req.json();
  const { taskDefinitionId, name, description, category, isCustom, pauseCurrentTask } = body;

  if (!name) {
    return NextResponse.json({ error: "Task name is required" }, { status: 400 });
  }

  // Get or create active shift
  let shift = await prisma.shift.findFirst({
    where: { userId: session.user.id, endTime: null },
  });

  if (!shift) {
    // Auto-start shift on first task
    shift = await prisma.shift.create({
      data: { userId: session.user.id, startTime: new Date() },
    });
  }

  const now = new Date();

  // Check for currently active task
  const activeTask = await prisma.taskEntry.findFirst({
    where: {
      userId: session.user.id,
      shiftId: shift.id,
      status: "ACTIVE",
    },
  });

  if (activeTask) {
    if (!pauseCurrentTask) {
      return NextResponse.json(
        {
          error: "TASK_ALREADY_ACTIVE",
          message: "Another task is currently running.",
          activeTask,
        },
        { status: 409 }
      );
    }

    // Pause the current active task
    const elapsed = activeTask.activeIntervalStart
      ? Math.floor((now.getTime() - new Date(activeTask.activeIntervalStart).getTime()) / 1000)
      : 0;

    await prisma.taskEntry.update({
      where: { id: activeTask.id },
      data: {
        status: "PAUSED",
        totalActiveTime: activeTask.totalActiveTime + elapsed,
        activeIntervalStart: null,
      },
    });

    await prisma.taskEventLog.create({
      data: {
        taskEntryId: activeTask.id,
        event: "PAUSED",
        note: "Paused to start a new task",
      },
    });
  }

  // Determine category from task definition if not provided
  let resolvedCategory = category || "WORK";
  if (taskDefinitionId && !isCustom) {
    const taskDef = await prisma.taskDefinition.findUnique({
      where: { id: taskDefinitionId },
    });
    if (taskDef) {
      resolvedCategory = taskDef.category;
    }
  }

  // Create and immediately start the new task
  const taskEntry = await prisma.taskEntry.create({
    data: {
      userId: session.user.id,
      shiftId: shift.id,
      taskDefinitionId: taskDefinitionId || null,
      name,
      description: description || null,
      category: resolvedCategory,
      isCustom: isCustom || false,
      status: "ACTIVE",
      startedAt: now,
      activeIntervalStart: now,
    },
  });

  // Log CREATED and STARTED events
  await prisma.taskEventLog.createMany({
    data: [
      { taskEntryId: taskEntry.id, event: "CREATED", timestamp: now },
      { taskEntryId: taskEntry.id, event: "STARTED", timestamp: now },
    ],
  });

  const fullTask = await prisma.taskEntry.findUnique({
    where: { id: taskEntry.id },
    include: {
      taskDefinition: true,
      events: { orderBy: { timestamp: "asc" } },
      review: true,
    },
  });

  return NextResponse.json({ task: fullTask, shift }, { status: 201 });
}

// GET /api/tasks - Get tasks for current user's active shift
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get("shiftId");
  const userId = searchParams.get("userId");

  // Employees can only see their own tasks
  const targetUserId =
    session.user.role === "ADMIN" && userId ? userId : session.user.id;

  const where: Record<string, unknown> = { userId: targetUserId };
  if (shiftId) where.shiftId = shiftId;

  const tasks = await prisma.taskEntry.findMany({
    where,
    include: {
      taskDefinition: true,
      events: { orderBy: { timestamp: "asc" } },
      review: { include: { admin: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}
