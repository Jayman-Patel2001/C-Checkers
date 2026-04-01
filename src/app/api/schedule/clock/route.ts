import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/schedule/clock — employee clock in or out for today
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, scheduleId, scheduledClockOut } = await req.json(); // "in" | "out", ID, optional scheduledClockOut for pre-setting

  if (!scheduleId) return NextResponse.json({ error: "No schedule specified" }, { status: 400 });

  const schedule = await prisma.employeeSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule || schedule.userId !== session.user.id || schedule.isDayOff) {
    return NextResponse.json({ error: "Invalid schedule" }, { status: 404 });
  }

  if (action === "in") {
    if (schedule.clockIn) {
      return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
    }
    const updated = await prisma.employeeSchedule.update({
      where: { id: schedule.id },
      data: { clockIn: new Date() },
    });
    return NextResponse.json({ schedule: updated });
  }

  if (action === "out") {
    if (!schedule.clockIn) {
      return NextResponse.json({ error: "Not clocked in yet" }, { status: 400 });
    }
    if (schedule.clockOut) {
      return NextResponse.json({ error: "Already clocked out" }, { status: 400 });
    }
    let clockOutTime = new Date();
    if (scheduledClockOut) {
      const preset = new Date(scheduledClockOut);
      if (!isNaN(preset.getTime())) clockOutTime = preset;
    }
    const updated = await prisma.employeeSchedule.update({
      where: { id: schedule.id },
      data: { clockOut: clockOutTime },
    });
    return NextResponse.json({ schedule: updated });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
