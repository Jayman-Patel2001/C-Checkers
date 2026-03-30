import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/task-definitions/:id/assign - Get assigned employees for a task
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const assignments = await prisma.taskAssignment.findMany({
    where: { taskDefinitionId: params.id },
    include: { taskDefinition: true },
  });

  const userIds = assignments.map((a) => a.userId);

  return NextResponse.json({ userIds });
}

// POST /api/task-definitions/:id/assign - Set assignments for a task
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { userIds } = body; // array of user IDs, or empty = available to all

  // Delete existing assignments
  await prisma.taskAssignment.deleteMany({
    where: { taskDefinitionId: params.id },
  });

  // Create new assignments
  if (userIds && userIds.length > 0) {
    await prisma.taskAssignment.createMany({
      data: userIds.map((userId: string) => ({
        taskDefinitionId: params.id,
        userId,
      })),
    });
  }

  return NextResponse.json({ success: true, userIds: userIds || [] });
}
