import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/schedule/my — employee's schedule for current week + payment history
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  // Current week start (Monday)
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const currentWeek = await prisma.weekSchedule.findFirst({
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
  });

  // Today's schedule for clock in/out
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySchedule = await prisma.employeeSchedule.findFirst({
    where: { userId: session.user.id, date: todayStart },
  });

  // Payment history (2 months) — only show paid entries to employee
  const payHistory = await prisma.weeklyPaySummary.findMany({
    where: {
      userId: session.user.id,
      isPaid: true,
      weekSchedule: { weekStartDate: { gte: twoMonthsAgo } },
    },
    include: { weekSchedule: { select: { weekStartDate: true, weekEndDate: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Calculate clocked hours this week (only days with both clockIn AND clockOut)
  let clockedHoursThisWeek = 0;
  if (currentWeek) {
    for (const s of currentWeek.employeeSchedules) {
      if (s.clockIn && s.clockOut) {
        const hours = (new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 3600000;
        clockedHoursThisWeek += hours;
      }
    }
  }

  // Get current pay rate for estimated earnings
  const latestRate = await prisma.employeePayRate.findFirst({
    where: { userId: session.user.id },
    orderBy: { effectiveFrom: "desc" },
  });

  const estimatedEarningsThisWeek = latestRate
    ? Math.round(clockedHoursThisWeek * latestRate.hourlyRate * 100) / 100
    : null;

  return NextResponse.json({ currentWeek, todaySchedule, payHistory, clockedHoursThisWeek: Math.round(clockedHoursThisWeek * 100) / 100, estimatedEarningsThisWeek });
}
