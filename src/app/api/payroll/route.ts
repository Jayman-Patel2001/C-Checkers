import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  
  if (endH < startH) endH += 24;
  
  if (endH <= startH) return { hours: 0, amount: 0 };
  let amount = 0;
  for (let h = Math.floor(startH); h < Math.ceil(endH); h++) {
    const fraction = Math.min(endH, h + 1) - Math.max(startH, h);
    const override = wageOverrides.find((o) => o.hourSlot === (h % 24));
    amount += (override ? override.customWage : hourlyRate) * fraction;
  }
  return {
    hours: Math.round((endH - startH) * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  };
}

// GET /api/payroll — admin overview of all weeks
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const weeks = await prisma.weekSchedule.findMany({
    where: { weekEndDate: { gte: twoMonthsAgo } },
    orderBy: { weekStartDate: "desc" },
    include: {
      employeeSchedules: { include: { wageOverrides: true } },
      paySummaries: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  const allUserIds = Array.from(new Set(weeks.flatMap((w: any) => w.employeeSchedules.map((s: any) => s.userId))));

  const [payRates, users] = await Promise.all([
    prisma.employeePayRate.findMany({
      where: { userId: { in: allUserIds } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, name: true },
    }),
  ]);

  const currentRates: Record<string, number> = {};
  for (const r of payRates) {
    if (!currentRates[r.userId]) currentRates[r.userId] = r.hourlyRate;
  }
  const userMap: Record<string, string> = {};
  for (const u of users) userMap[u.id] = u.name;

  // Determine current week ID using Chicago local time (not UTC)
  const chicagoStr = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
  const chicagoNow = new Date(chicagoStr);
  const chicagoDow = chicagoNow.getDay();
  const chicagoDiff = chicagoDow === 0 ? -6 : 1 - chicagoDow;
  const chicagoWeekStart = new Date(chicagoNow);
  chicagoWeekStart.setDate(chicagoNow.getDate() + chicagoDiff);
  chicagoWeekStart.setHours(0, 0, 0, 0);
  const chicagoWeekKey = `${chicagoWeekStart.getFullYear()}-${String(chicagoWeekStart.getMonth() + 1).padStart(2, "0")}-${String(chicagoWeekStart.getDate()).padStart(2, "0")}`;
  const currentWeekId = weeks.find((w: any) => w.weekStartDate.toISOString().startsWith(chicagoWeekKey))?.id ?? null;

  const result = weeks.map((week: any) => {
    const byUser: Record<string, typeof week.employeeSchedules> = {};
    for (const s of week.employeeSchedules) {
      if (!byUser[s.userId]) byUser[s.userId] = [];
      byUser[s.userId].push(s);
    }

    const employees = Object.entries(byUser).map(([userId, schedules]) => {
      const hourlyRate = currentRates[userId] ?? 0;
      let clockedHours = 0;
      let amount = 0;
      for (const s of schedules) {
        const { hours, amount: a } = calcClockedPay(s.clockIn, s.clockOut, s.wageOverrides, hourlyRate);
        clockedHours += hours;
        amount += a;
      }
      clockedHours = Math.round(clockedHours * 100) / 100;
      amount = Math.round(amount * 100) / 100;
      const summary = week.paySummaries.find((p: any) => p.userId === userId);
      return { userId, name: userMap[userId] ?? userId, hourlyRate, clockedHours, amount, isPaid: summary?.isPaid ?? false, paidAt: summary?.paidAt ?? null, notes: summary?.notes ?? null, paidAmount: summary?.isPaid ? summary.totalAmount : null };
    }).filter((e) => e.clockedHours > 0 || e.isPaid);

    return { weekId: week.id, weekStartDate: week.weekStartDate, weekEndDate: week.weekEndDate, employees, isCurrentWeek: week.id === currentWeekId };
  }).filter((w: any) => w.employees.length > 0);

  return NextResponse.json({ weeks: result });
}
