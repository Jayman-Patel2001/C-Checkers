import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyMissedClockOuts } from "@/lib/auto-clockout";

function getLocalHourFloat(d: Date): number {
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour12: false, hour: "numeric", minute: "numeric" });
  const [h, m] = timeStr.split(":").map(Number);
  return (h === 24 ? 0 : h) + (m / 60);
}

function calcClockedPay(
  clockIn: Date | null, clockOut: Date | null,
  wageOverrides: { hourSlot: number; customWage: number }[],
  hourlyRate: number
): { hours: number; amount: number } {
  if (!clockIn || !clockOut) return { hours: 0, amount: 0 };
  const startH = getLocalHourFloat(clockIn);
  let endH = getLocalHourFloat(clockOut);
  
  // Handle overnight shifts spanning past midnight gracefully for pay calculation
  if (endH < startH) endH += 24;
  
  if (endH <= startH) return { hours: 0, amount: 0 };
  let amount = 0;
  for (let h = Math.floor(startH); h < Math.ceil(endH); h++) {
    const fraction = Math.min(endH, h + 1) - Math.max(startH, h);
    // Use h % 24 from the loop index so hourSlots late at night (e.g. 1 AM) still match perfectly
    const override = wageOverrides.find((o) => o.hourSlot === (h % 24));
    amount += (override ? override.customWage : hourlyRate) * fraction;
  }
  return {
    hours: Math.round((endH - startH) * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  };
}

// GET /api/schedule/my — employee's schedule for current week + week-wise pay history
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await applyMissedClockOuts();

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  // Current week start (Monday) — MUST use local America/Chicago time to determine the current day,
  // otherwise Vercel's UTC clock will roll over to Monday at 7:00 PM CDT on Sunday evening,
  // prematurely fetching NEXT week's schedule and locking employees out of Sunday night shifts.
  const utcNow = new Date();
  const cstStr = utcNow.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const today = new Date(cstStr);
  
  const day = today.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() + diff);
  weekStart.setUTCHours(0, 0, 0, 0);

  const [currentWeek, upcomingWeeks, allWeeks, latestRate] = await Promise.all([
    prisma.weekSchedule.findFirst({
      where: {
        weekStartDate: { lte: today },
        weekEndDate: { gte: weekStart },
      },
      include: {
        employeeSchedules: {
          where: { userId: session.user.id },
          orderBy: { date: "asc" },
          include: { wageOverrides: true },
        },
      },
      orderBy: { weekStartDate: "desc" },
    }),
    // Upcoming weeks where this employee has at least one real shift assigned
    prisma.weekSchedule.findMany({
      where: {
        weekStartDate: { gt: weekStart },
        visibleToEmployees: true,
        employeeSchedules: {
          some: {
            userId: session.user.id,
            isDayOff: false,
            scheduledStart: { not: null },
          },
        },
      },
      orderBy: { weekStartDate: "asc" },
      include: {
        employeeSchedules: {
          where: { userId: session.user.id },
          orderBy: { date: "asc" },
        },
      },
    }),
    // All weeks for pay history
    prisma.weekSchedule.findMany({
      where: { weekEndDate: { gte: twoMonthsAgo } },
      orderBy: { weekStartDate: "desc" },
      include: {
        employeeSchedules: {
          where: { userId: session.user.id },
          include: { wageOverrides: true },
        },
        paySummaries: {
          where: { userId: session.user.id },
        },
      },
    }),
    // Current pay rate
    prisma.employeePayRate.findFirst({
      where: { userId: session.user.id },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);
  const hourlyRate = latestRate?.hourlyRate ?? 0;

  let clockedHoursThisWeek = 0;
  let estimatedEarningsThisWeek: number | null = null;

  const payWeeks = allWeeks.map((week: any) => {
    let clockedHours = 0;
    let estimatedAmount = 0;
    for (const s of week.employeeSchedules) {
      if (s.isDayOff) continue;
      const { hours, amount } = calcClockedPay(s.clockIn, s.clockOut, s.wageOverrides, hourlyRate);
      clockedHours += hours;
      estimatedAmount += amount;
    }
    clockedHours = Math.round(clockedHours * 100) / 100;
    estimatedAmount = Math.round(estimatedAmount * 100) / 100;

    const summary = week.paySummaries[0] ?? null;
    const isCurrentWeek = currentWeek?.id === week.id;

    if (isCurrentWeek) {
      clockedHoursThisWeek = clockedHours;
      estimatedEarningsThisWeek = latestRate ? estimatedAmount : null;
    }

    // Detect hours worked after a partial payment — those are NOT yet paid
    const paidSnapshotAmount = summary?.isPaid ? (summary.totalAmount ?? 0) : 0;
    const paidSnapshotHours = summary?.isPaid ? (summary.totalHours ?? 0) : 0;
    const additionalAmount = summary?.isPaid
      ? Math.max(0, Math.round((estimatedAmount - paidSnapshotAmount) * 100) / 100)
      : 0;
    const additionalHours = summary?.isPaid
      ? Math.max(0, Math.round((clockedHours - paidSnapshotHours) * 100) / 100)
      : 0;

    return {
      weekId: week.id,
      weekStartDate: week.weekStartDate,
      weekEndDate: week.weekEndDate,
      clockedHours,
      estimatedAmount,
      isPaid: summary?.isPaid ?? false,
      paidAt: summary?.paidAt ?? null,
      confirmedAmount: summary?.totalAmount ?? null,
      notes: summary?.notes ?? null,
      isCurrentWeek,
      additionalHours,
      additionalAmount,
    };
  }).filter((w: any) => w.clockedHours > 0 || w.isPaid);

  return NextResponse.json({
    currentWeek,
    upcomingWeeks,
    payWeeks,
    clockedHoursThisWeek: Math.round(clockedHoursThisWeek * 100) / 100,
    estimatedEarningsThisWeek,
  });
}
