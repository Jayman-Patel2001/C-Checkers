import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/task-definitions - Get all active task definitions
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.taskDefinition.findMany({
    where: session.user.role === "ADMIN" ? {} : { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ tasks });
}

// POST /api/task-definitions - Create a new task definition (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, category, sortOrder } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const task = await prisma.taskDefinition.create({
    data: {
      name,
      description: description || null,
      category: category || "WORK",
      sortOrder: sortOrder || 0,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
