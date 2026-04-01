import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const week = await prisma.weekSchedule.findUnique({
    where: { id: params.weekId },
    include: {
      employeeSchedules: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          wageOverrides: { orderBy: { hourSlot: "asc" } },
        },
        orderBy: [{ userId: "asc" }, { date: "asc" }],
      },
      paySummaries: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  // Attach current pay rate to each unique user
  const userIds = [...new Set(week.employeeSchedules.map((s) => s.userId))];
  const payRates = await prisma.employeePayRate.findMany({
    where: { userId: { in: userIds } },
    orderBy: { effectiveFrom: "desc" },
  });

  const currentRates: Record<string, number> = {};
  for (const rate of payRates) {
    if (!currentRates[rate.userId]) currentRates[rate.userId] = rate.hourlyRate;
  }

  return NextResponse.json({ week, currentRates });
}

export async function DELETE(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await prisma.weekSchedule.delete({ where: { id: params.weekId } });
  return NextResponse.json({ success: true });
}
