import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/shifts - Get current active shift for logged-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user.role === "EMPLOYEE" || session.user.role === "CO_ADMIN") ? session.user.id : undefined;

  const activeShift = await prisma.shift.findFirst({
    where: {
      userId: userId,
      endTime: null,
    },
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

  return NextResponse.json({ shift: activeShift });
}

// POST /api/shifts - Start a new shift
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "EMPLOYEE" && session.user.role !== "CO_ADMIN") {
    return NextResponse.json({ error: "Only employees can start shifts" }, { status: 403 });
  }

  // Check if there's already an active shift
  const existingShift = await prisma.shift.findFirst({
    where: {
      userId: session.user.id,
      endTime: null,
    },
  });

  if (existingShift) {
    return NextResponse.json({ error: "You already have an active shift", shift: existingShift }, { status: 400 });
  }

  const shift = await prisma.shift.create({
    data: {
      userId: session.user.id,
      startTime: new Date(),
    },
  });

  return NextResponse.json({ shift }, { status: 201 });
}
