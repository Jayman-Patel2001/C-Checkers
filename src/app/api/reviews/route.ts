import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function canReview(role: string) {
  return role === "ADMIN" || role === "CO_ADMIN";
}

// GET /api/reviews - Get tasks pending review
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const includeReviewed = searchParams.get("includeReviewed") === "true";

  if (canReview(session.user.role)) {
    // Admin/Co-Admin: see completed tasks from the last 7 days only
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Record<string, unknown> = {
      status: "COMPLETED",
      completedAt: { gte: sevenDaysAgo },
    };
    if (!includeReviewed) where.review = null; // only unreviewed
    if (userId) where.userId = userId;
    // Co-admin cannot review their own tasks — exclude from list
    if (session.user.role === "CO_ADMIN") {
      where.NOT = { userId: session.user.id };
    }

    const tasks = await prisma.taskEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } },
        taskDefinition: true,
        events: { orderBy: { timestamp: "asc" } },
        shift: { select: { id: true, startTime: true } },
        review: { include: { admin: { select: { id: true, name: true } } } },
      },
      orderBy: { completedAt: "desc" },
    });

    return NextResponse.json({ tasks });
  }

  // Employee: see their own reviews
  const reviews = await prisma.review.findMany({
    where: { taskEntry: { userId: session.user.id } },
    include: {
      taskEntry: {
        include: { taskDefinition: true, events: { orderBy: { timestamp: "asc" } } },
      },
      admin: { select: { id: true, name: true } },
    },
    orderBy: { reviewedAt: "desc" },
  });

  return NextResponse.json({ reviews });
}

// POST /api/reviews - Submit a review (admin and co-admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canReview(session.user.role)) {
    return NextResponse.json({ error: "Admin or Co-Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { taskEntryId, status, comment } = body;

  if (!taskEntryId || !status) {
    return NextResponse.json({ error: "taskEntryId and status are required" }, { status: 400 });
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const task = await prisma.taskEntry.findUnique({ where: { id: taskEntryId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "COMPLETED") {
    return NextResponse.json({ error: "Task must be completed" }, { status: 400 });
  }

  // Co-admin cannot review their own tasks
  if (session.user.role === "CO_ADMIN" && task.userId === session.user.id) {
    return NextResponse.json({ error: "You cannot review your own tasks" }, { status: 403 });
  }

  const existing = await prisma.review.findUnique({
    where: { taskEntryId },
    include: { admin: { select: { id: true, role: true } } },
  });

  // Co-admin cannot overwrite a review given by an admin
  if (existing && session.user.role === "CO_ADMIN" && existing.admin.role === "ADMIN") {
    return NextResponse.json({ error: "Cannot update a review given by an admin" }, { status: 403 });
  }

  if (existing) {
    const updated = await prisma.review.update({
      where: { taskEntryId },
      data: { status, comment: comment || null, adminId: session.user.id, reviewedAt: new Date() },
      include: {
        taskEntry: {
          include: { taskDefinition: true, user: { select: { id: true, name: true } } },
        },
        admin: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ review: updated });
  }

  const review = await prisma.review.create({
    data: { taskEntryId, adminId: session.user.id, status, comment: comment || null },
    include: {
      taskEntry: {
        include: { taskDefinition: true, user: { select: { id: true, name: true } } },
      },
      admin: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}
