import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const rates = await prisma.employeePayRate.findMany({
    where: { userId: params.id },
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json({ rates, current: rates[0] ?? null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { hourlyRate } = await req.json();

  if (!hourlyRate || hourlyRate <= 0) {
    return NextResponse.json({ error: "Invalid hourly rate" }, { status: 400 });
  }

  const rate = await prisma.employeePayRate.create({
    data: { userId: params.id, hourlyRate, effectiveFrom: new Date() },
  });

  return NextResponse.json({ rate }, { status: 201 });
}
