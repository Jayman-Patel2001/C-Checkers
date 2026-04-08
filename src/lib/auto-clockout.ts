import { prisma } from "./prisma";

const TZ = "America/Chicago";

/**
 * Converts a calendar date (stored as UTC midnight) + a local time string "HH:MM"
 * into the correct UTC Date for that moment in America/Chicago.
 * Works correctly regardless of the server's system timezone.
 */
function buildScheduledEndUtc(date: Date, scheduledEnd: string): Date {
  const dateStr = date.toISOString().slice(0, 10); // "2026-04-07"
  const [h, m] = scheduledEnd.split(":").map(Number);

  // Build a naive UTC point treating the local H:M as if it were UTC
  const naive = new Date(Date.UTC(
    +dateStr.slice(0, 4),
    +dateStr.slice(5, 7) - 1,
    +dateStr.slice(8, 10),
    h, m, 0,
  ));

  // Ask Intl what Chicago's local time is at that UTC point
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(naive).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = +p.value;
    return acc;
  }, {} as Record<string, number>);

  // Reconstruct that Chicago reading as a UTC timestamp (no tz offset)
  const chicagoAsUtc = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
  ));

  // offsetMs = how many ms UTC is ahead of Chicago at this moment
  const offsetMs = naive.getTime() - chicagoAsUtc.getTime();

  // Actual UTC instant = naive target + offset
  return new Date(naive.getTime() + offsetMs);
}

/**
 * Auto-clocks out any employees who clocked in but forgot to clock out,
 * and whose scheduled end time has already passed.
 * Sets clockOut to the scheduled end time (not current time).
 *
 * Safe to call on every schedule fetch — no-ops if nothing is pending.
 */
export async function applyMissedClockOuts(): Promise<void> {
  const now = new Date();

  const pending = await prisma.employeeSchedule.findMany({
    where: {
      clockIn: { not: null },
      clockOut: null,
      isDayOff: false,
      scheduledEnd: { not: null },
    },
    select: { id: true, date: true, scheduledEnd: true },
  });

  if (pending.length === 0) return;

  const toClockOut: { id: string; clockOutTime: Date }[] = [];

  for (const s of pending) {
    if (!s.scheduledEnd) continue;

    const scheduledEndTime = buildScheduledEndUtc(s.date, s.scheduledEnd);

    if (isNaN(scheduledEndTime.getTime())) continue;

    // Only apply once the calendar day of the shift has fully ended (past midnight Chicago time).
    // The schedule date is stored as UTC midnight representing the local date.
    // Midnight = start of the NEXT day, so we add 1 day.
    const dateStr = s.date.toISOString().slice(0, 10);
    const [y, mo, d] = dateStr.split("-").map(Number);
    const midnightEndOfDay = buildScheduledEndUtc(
      new Date(Date.UTC(y, mo - 1, d + 1)), // next calendar day
      "00:00",
    );

    if (midnightEndOfDay < now) {
      toClockOut.push({ id: s.id, clockOutTime: scheduledEndTime });
    }
  }

  if (toClockOut.length === 0) return;

  await Promise.all(
    toClockOut.map(({ id, clockOutTime }) =>
      prisma.employeeSchedule.update({
        where: { id },
        data: { clockOut: clockOutTime },
      })
    )
  );
}
