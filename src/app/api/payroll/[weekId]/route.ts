import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseHour(time: string): number {
  const [h] = time.split(":").map(Number);
  return h;
}

// Scheduled hours (for display only)
function calcScheduledHours(
  scheduledStart: string | null,
  scheduledEnd: string | null,
  isDayOff: boolean,
): number {
  if (isDayOff || !scheduledStart || !scheduledEnd) return 0;
  const start = parseHour(scheduledStart);
  const end = scheduledEnd === "00:00" ? 24 : parseHour(scheduledEnd);
  return Math.max(0, end - start);
}

function getLocalHourFloat(d: Date): number {
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour12: false, hour: "numeric", minute: "numeric" });
  const [h, m] = timeStr.split(":").map(Number);
  return (h === 24 ? 0 : h) + (m / 60);
}

// Actual pay from clocked hours — applies wage overrides per hour slot
function calcClockedPay(
  clockIn: Date | null,
  clockOut: Date | null,
  wageOverrides: { hourSlot: number; customWage: number }[],
  hourlyRate: number
): { hours: number; amount: number } {
  if (!clockIn || !clockOut) return { hours: 0, amount: 0 };

  const startH = getLocalHourFloat(clockIn);
  let endH = getLocalHourFloat(clockOut);
  if (endH < startH) endH += 24;
  if (endH <= startH) return { hours: 0, amount: 0 };

  const totalHours = endH - startH;
  let amount = 0;
  const startSlot = Math.floor(startH);
  const endSlot = Math.ceil(endH);

  for (let h = startSlot; h < endSlot; h++) {
    const fraction = Math.min(endH, h + 1) - Math.max(startH, h);
    const override = wageOverrides.find((o) => o.hourSlot === (h % 24));
    amount += (override ? override.customWage : hourlyRate) * fraction;
  }

  return {
    hours: Math.round(totalHours * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  };
}

// GET /api/payroll/[weekId] — calculate and return pay summaries
export async function GET(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const week = await prisma.weekSchedule.findUnique({
    where: { id: params.weekId },
    include: {
      employeeSchedules: {
        include: { wageOverrides: true },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Week not found" }, { status: 404 });

  // Group schedules by user
  const byUser: Record<string, typeof week.employeeSchedules> = {};
  for (const s of week.employeeSchedules) {
    if (!byUser[s.userId]) byUser[s.userId] = [];
    byUser[s.userId].push(s);
  }

  const userIds = Object.keys(byUser);
  const payRates = await prisma.employeePayRate.findMany({
    where: { userId: { in: userIds } },
    orderBy: { effectiveFrom: "desc" },
  });

  const currentRates: Record<string, number> = {};
  for (const rate of payRates) {
    if (!currentRates[rate.userId]) currentRates[rate.userId] = rate.hourlyRate;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });

  const summaries = [];
  for (const userId of userIds) {
    const schedules = byUser[userId];
    const hourlyRate = currentRates[userId] ?? 0;
    let totalHours = 0;
    let totalAmount = 0;
    let scheduledHours = 0;

    for (const s of schedules) {
      scheduledHours += calcScheduledHours(s.scheduledStart, s.scheduledEnd, s.isDayOff);
      const { hours, amount } = calcClockedPay(
        s.clockIn,
        s.clockOut,
        s.wageOverrides,
        hourlyRate
      );
      totalHours += hours;
      totalAmount += amount;
    }

    const existing = await prisma.weeklyPaySummary.upsert({
      where: { weekScheduleId_userId: { weekScheduleId: params.weekId, userId } },
      update: { totalHours, totalAmount },
      create: { weekScheduleId: params.weekId, userId, totalHours, totalAmount },
      include: { user: { select: { id: true, name: true } } },
    });

    summaries.push({ ...existing, hourlyRate, scheduledHours });
  }

  return NextResponse.json({ summaries, users });
}

// POST /api/payroll/[weekId] — mark employee as paid, snapshot hours/amount at payment time
export async function POST(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { userId, paidAt, notes } = await req.json();

  // Calculate clocked pay at the moment of payment
  const [schedules, payRate] = await Promise.all([
    prisma.employeeSchedule.findMany({
      where: { weekScheduleId: params.weekId, userId },
      include: { wageOverrides: true },
    }),
    prisma.employeePayRate.findFirst({
      where: { userId },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const hourlyRate = payRate?.hourlyRate ?? 0;
  let totalHours = 0;
  let totalAmount = 0;
  for (const s of schedules) {
    const { hours, amount } = calcClockedPay(s.clockIn, s.clockOut, s.wageOverrides, hourlyRate);
    totalHours += hours;
    totalAmount += amount;
  }
  totalHours = Math.round(totalHours * 100) / 100;
  totalAmount = Math.round(totalAmount * 100) / 100;

  const summary = await prisma.weeklyPaySummary.upsert({
    where: { weekScheduleId_userId: { weekScheduleId: params.weekId, userId } },
    update: {
      isPaid: true,
      paidAt: new Date(paidAt),
      paidByAdminId: session.user.id,
      notes: notes || null,
      totalHours,
      totalAmount,
    },
    create: {
      weekScheduleId: params.weekId,
      userId,
      isPaid: true,
      paidAt: new Date(paidAt),
      paidByAdminId: session.user.id,
      notes: notes || null,
      totalHours,
      totalAmount,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ summary });
}
