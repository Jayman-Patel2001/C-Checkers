import { NextRequest, NextResponse } from "next/server";
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

// PATCH — update a single employee-day (time, dayOff, notes, wage overrides)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { weekId: string; scheduleId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  const { scheduledStart, scheduledEnd, isDayOff, notes, userId, wageOverrides, clockIn, clockOut } = body;

  const updateData: Record<string, unknown> = {};
  if (scheduledStart !== undefined) updateData.scheduledStart = scheduledStart;
  if (scheduledEnd !== undefined) updateData.scheduledEnd = scheduledEnd;
  if (isDayOff !== undefined) {
    updateData.isDayOff = isDayOff;
    if (isDayOff) {
      updateData.scheduledStart = null;
      updateData.scheduledEnd = null;
      // Always clear clock times when marking as day-off
      updateData.clockIn = null;
      updateData.clockOut = null;
    }
  }
  if (notes !== undefined) updateData.notes = notes;
  if (userId !== undefined) updateData.userId = userId;
  // Admin can override clock in/out times (only applied when not day-off)
  if (!isDayOff && clockIn !== undefined) updateData.clockIn = clockIn ? new Date(clockIn) : null;
  if (!isDayOff && clockOut !== undefined) updateData.clockOut = clockOut ? new Date(clockOut) : null;

  const schedule = await prisma.employeeSchedule.update({
    where: { id: params.scheduleId },
    data: updateData,
    include: { wageOverrides: true },
  });

  // Handle wage overrides if provided
  if (wageOverrides !== undefined) {
    await prisma.wageOverride.deleteMany({ where: { employeeScheduleId: params.scheduleId } });
    if (wageOverrides.length > 0) {
      await prisma.wageOverride.createMany({
        data: wageOverrides.map((o: { hourSlot: number; customWage: number; reason?: string }) => ({
          employeeScheduleId: params.scheduleId,
          hourSlot: o.hourSlot,
          customWage: o.customWage,
          reason: o.reason || null,
        })),
      });
    }
  }

  // If clock times or day-off status changed, recalculate and update any existing paid summary.
  // This ensures removing a worked shift also removes those hours from the paid total.
  const affectsPay = isDayOff === true || clockIn !== undefined || clockOut !== undefined || wageOverrides !== undefined;
  if (affectsPay) {
    const paidSummary = await prisma.weeklyPaySummary.findUnique({
      where: { weekScheduleId_userId: { weekScheduleId: params.weekId, userId: schedule.userId } },
    });

    if (paidSummary?.isPaid) {
      const [allSchedules, payRate] = await Promise.all([
        prisma.employeeSchedule.findMany({
          where: { weekScheduleId: params.weekId, userId: schedule.userId },
          include: { wageOverrides: true },
        }),
        prisma.employeePayRate.findFirst({
          where: { userId: schedule.userId },
          orderBy: { effectiveFrom: "desc" },
        }),
      ]);

      const hourlyRate = payRate?.hourlyRate ?? 0;
      let totalHours = 0;
      let totalAmount = 0;
      for (const s of allSchedules) {
        if (s.isDayOff) continue;
        const { hours, amount } = calcClockedPay(s.clockIn, s.clockOut, s.wageOverrides, hourlyRate);
        totalHours += hours;
        totalAmount += amount;
      }
      totalHours = Math.round(totalHours * 100) / 100;
      totalAmount = Math.round(totalAmount * 100) / 100;

      await prisma.weeklyPaySummary.update({
        where: { weekScheduleId_userId: { weekScheduleId: params.weekId, userId: schedule.userId } },
        data: { totalHours, totalAmount },
      });
    }
  }

  const updated = await prisma.employeeSchedule.findUnique({
    where: { id: params.scheduleId },
    include: {
      user: { select: { id: true, name: true } },
      wageOverrides: { orderBy: { hourSlot: "asc" } },
    },
  });

  return NextResponse.json({ schedule: updated });
}
