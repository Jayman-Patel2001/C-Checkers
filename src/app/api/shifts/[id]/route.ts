import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/shifts/:id - End a shift
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      taskEntries: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Only the shift owner or admin can end it
  if (session.user.role !== "ADMIN" && shift.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (shift.endTime) {
    return NextResponse.json({ error: "Shift already ended" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { forceEnd } = body;

  // Check for running/paused tasks
  const activeTasks = shift.taskEntries.filter((t) => t.status === "ACTIVE");
  if (activeTasks.length > 0 && !forceEnd) {
    return NextResponse.json(
      {
        error: "TASK_RUNNING",
        message: "A task is currently running. Stop the task before ending your shift.",
        taskCount: activeTasks.length,
      },
      { status: 400 }
    );
  }

  const now = new Date();

  // If forceEnd, pause all active tasks
  if (forceEnd) {
    for (const task of activeTasks) {
      const elapsed = task.activeIntervalStart
        ? Math.floor((now.getTime() - new Date(task.activeIntervalStart).getTime()) / 1000)
        : 0;

      await prisma.taskEntry.update({
        where: { id: task.id },
        data: {
          status: "PAUSED",
          totalActiveTime: task.totalActiveTime + elapsed,
          activeIntervalStart: null,
        },
      });

      await prisma.taskEventLog.create({
        data: {
          taskEntryId: task.id,
          event: "PAUSED",
          note: "Paused due to shift end",
        },
      });
    }
  }

  const updatedShift = await prisma.shift.update({
    where: { id: params.id },
    data: { endTime: now },
  });

  return NextResponse.json({ shift: updatedShift });
}

// GET /api/shifts/:id - Get shift details (admin)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      taskEntries: {
        include: {
          taskDefinition: true,
          events: { orderBy: { timestamp: "asc" } },
          review: { include: { admin: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Employees can only see their own shifts
  if (session.user.role !== "ADMIN" && shift.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ shift });
}
