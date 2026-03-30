import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/tasks/:id - Update task status (pause, resume, complete) or admin edits
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  const task = await prisma.taskEntry.findUnique({
    where: { id: params.id },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Employees can only modify their own tasks
  if (session.user.role !== "ADMIN" && task.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  // Admin-only: edit task details (name, description, category)
  if (action === "admin-edit") {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { name, description, category } = body;
    const updated = await prisma.taskEntry.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
      },
      include: {
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        review: true,
        user: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ task: updated });
  }

  if (action === "pause") {
    if (task.status !== "ACTIVE") {
      return NextResponse.json({ error: "Task is not active" }, { status: 400 });
    }

    const elapsed = task.activeIntervalStart
      ? Math.floor((now.getTime() - new Date(task.activeIntervalStart).getTime()) / 1000)
      : 0;

    const updated = await prisma.taskEntry.update({
      where: { id: params.id },
      data: {
        status: "PAUSED",
        totalActiveTime: task.totalActiveTime + elapsed,
        activeIntervalStart: null,
      },
      include: {
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        review: true,
      },
    });

    await prisma.taskEventLog.create({
      data: { taskEntryId: params.id, event: "PAUSED", timestamp: now },
    });

    return NextResponse.json({ task: updated });
  }

  if (action === "resume") {
    if (task.status !== "PAUSED") {
      return NextResponse.json({ error: "Task is not paused" }, { status: 400 });
    }

    // Check if another task is already active in the same shift
    const activeTask = await prisma.taskEntry.findFirst({
      where: {
        userId: task.userId,
        shiftId: task.shiftId,
        status: "ACTIVE",
        id: { not: params.id },
      },
    });

    const pauseOther = body.pauseCurrentTask;

    if (activeTask) {
      if (!pauseOther) {
        return NextResponse.json(
          {
            error: "TASK_ALREADY_ACTIVE",
            message: "Another task is currently running.",
            activeTask,
          },
          { status: 409 }
        );
      }

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
          note: "Paused to resume another task",
        },
      });
    }

    const updated = await prisma.taskEntry.update({
      where: { id: params.id },
      data: {
        status: "ACTIVE",
        activeIntervalStart: now,
      },
      include: {
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        review: true,
      },
    });

    await prisma.taskEventLog.create({
      data: { taskEntryId: params.id, event: "RESUMED", timestamp: now },
    });

    return NextResponse.json({ task: updated });
  }

  if (action === "complete") {
    if (task.status !== "ACTIVE" && task.status !== "PAUSED") {
      return NextResponse.json({ error: "Task cannot be completed" }, { status: 400 });
    }

    let totalTime = task.totalActiveTime;
    if (task.status === "ACTIVE" && task.activeIntervalStart) {
      const elapsed = Math.floor(
        (now.getTime() - new Date(task.activeIntervalStart).getTime()) / 1000
      );
      totalTime += elapsed;
    }

    const updated = await prisma.taskEntry.update({
      where: { id: params.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        totalActiveTime: totalTime,
        activeIntervalStart: null,
      },
      include: {
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        review: true,
      },
    });

    await prisma.taskEventLog.create({
      data: { taskEntryId: params.id, event: "COMPLETED", timestamp: now },
    });

    return NextResponse.json({ task: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// GET /api/tasks/:id - Get a single task with full event history
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await prisma.taskEntry.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      taskDefinition: true,
      events: { orderBy: { timestamp: "asc" } },
      review: { include: { admin: { select: { id: true, name: true } } } },
      shift: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (session.user.role !== "ADMIN" && task.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ task });
}

// DELETE /api/tasks/:id - Delete a task (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const task = await prisma.taskEntry.findUnique({ where: { id: params.id } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.taskEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
