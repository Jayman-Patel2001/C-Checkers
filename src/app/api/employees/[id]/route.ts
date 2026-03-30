import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/employees/:id - Get employee details with stats
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const employee = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      shifts: {
        orderBy: { startTime: "desc" },
        take: 3,
        include: {
          taskEntries: {
            include: {
              taskDefinition: true,
              events: { orderBy: { timestamp: "asc" } },
              review: true,
            },
          },
        },
      },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json({ employee });
}

// PATCH /api/employees/:id - Update employee (name, email, password, isActive)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, isActive } = body;

  // Check email uniqueness if being changed
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: params.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use by another account" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(password, 10);
  }

  const employee = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  return NextResponse.json({ employee });
}

// DELETE /api/employees/:id - Hard delete employee
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Prevent deleting self
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const employee = await prisma.user.findUnique({ where: { id: params.id } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (employee.role === "ADMIN") {
    return NextResponse.json({ error: "Cannot delete admin accounts" }, { status: 400 });
  }

  // Delete cascades to shifts, task entries, events, reviews
  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
