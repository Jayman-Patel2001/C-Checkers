import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const records = await prisma.employeeSchedule.findMany({
    where: { userId: params.id, clockIn: { not: null } },
    orderBy: { date: "desc" },
    take: 3,
    select: {
      id: true,
      date: true,
      scheduledStart: true,
      scheduledEnd: true,
      clockIn: true,
      clockOut: true,
    },
  });

  return NextResponse.json({ records });
}
