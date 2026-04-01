import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULTS = [
  { dayOfWeek: 0, openTime: "06:00", closeTime: "23:00" },
  { dayOfWeek: 1, openTime: "06:00", closeTime: "23:00" },
  { dayOfWeek: 2, openTime: "06:00", closeTime: "23:00" },
  { dayOfWeek: 3, openTime: "06:00", closeTime: "23:00" },
  { dayOfWeek: 4, openTime: "06:00", closeTime: "00:00" },
  { dayOfWeek: 5, openTime: "06:00", closeTime: "00:00" },
  { dayOfWeek: 6, openTime: "07:00", closeTime: "23:00" },
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let hours = await prisma.shopHours.findMany({ orderBy: { dayOfWeek: "asc" } });

  if (hours.length < 7) {
    await prisma.shopHours.deleteMany();
    await prisma.shopHours.createMany({ data: DEFAULTS });
    hours = await prisma.shopHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  }

  return NextResponse.json({ hours });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { dayOfWeek, openTime, closeTime } = await req.json();

  const updated = await prisma.shopHours.upsert({
    where: { dayOfWeek },
    update: { openTime, closeTime },
    create: { dayOfWeek, openTime, closeTime },
  });

  return NextResponse.json({ hours: updated });
}
