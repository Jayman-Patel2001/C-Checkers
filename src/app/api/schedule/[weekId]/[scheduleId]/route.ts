import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    }
  }
  if (notes !== undefined) updateData.notes = notes;
  if (userId !== undefined) updateData.userId = userId;
  // Admin can override clock in/out times
  if (clockIn !== undefined) updateData.clockIn = clockIn ? new Date(clockIn) : null;
  if (clockOut !== undefined) updateData.clockOut = clockOut ? new Date(clockOut) : null;

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

  const updated = await prisma.employeeSchedule.findUnique({
    where: { id: params.scheduleId },
    include: {
      user: { select: { id: true, name: true } },
      wageOverrides: { orderBy: { hourSlot: "asc" } },
    },
  });

  return NextResponse.json({ schedule: updated });
}
