"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useState } from "react";
import { LogIn, LogOut, CheckCircle, Clock, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatTime12(t: string) {
  if (!t) return "";
  if (t === "00:00") return "12am";
  const [h, m] = t.split(":").map(Number);
  const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  if (h === 0) return `12${mStr}am`;
  if (h === 12) return `12${mStr}pm`;
  return h > 12 ? `${h - 12}${mStr}pm` : `${h}${mStr}am`;
}

interface ScheduleEntry {
  id: string; date: string; scheduledStart: string | null; scheduledEnd: string | null;
  isDayOff: boolean; clockIn: string | null; clockOut: string | null;
}
interface PayWeek {
  weekId: string; weekStartDate: string; weekEndDate: string;
  clockedHours: number; estimatedAmount: number;
  isPaid: boolean; paidAt: string | null;
  confirmedAmount: number | null; notes: string | null;
  isCurrentWeek: boolean;
}

export default function EmployeeSchedulePage() {
  const { success, error: showError } = useToast();
  const [clocking, setClocking] = useState(false);
  const [showPreset, setShowPreset] = useState(false);
  const [presetHour, setPresetHour] = useState("5");
  const [presetMin, setPresetMin] = useState("00");
  const [presetAmpm, setPresetAmpm] = useState<"AM" | "PM">("PM");

  const { data, mutate } = useSWR<{
    currentWeek: { weekStartDate: string; weekEndDate: string; employeeSchedules: ScheduleEntry[] } | null;
    payWeeks: PayWeek[];
    clockedHoursThisWeek: number;
    estimatedEarningsThisWeek: number | null;
  }>("/api/schedule/my", fetcher, { refreshInterval: 30000 });

  function buildPresetDateTime() {
    let h = parseInt(presetHour);
    if (presetAmpm === "PM" && h !== 12) h += 12;
    if (presetAmpm === "AM" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, parseInt(presetMin), 0, 0);
    return d.toISOString();
  }

  async function clock(action: "in" | "out", withPreset = false) {
    if (!today?.id) return;
    setClocking(true);
    try {
      const body: { action: string; scheduleId: string; scheduledClockOut?: string } = { action, scheduleId: today.id };
      if (action === "out" && withPreset) {
        body.scheduledClockOut = buildPresetDateTime();
      }
      const res = await fetch("/api/schedule/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success(action === "in" ? "Clocked in!" : "Clocked out!");
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setClocking(false);
    }
  }

  const week = data?.currentWeek;

  // Find today's schedule out of the loaded week, based on the user's REAL local date
  const today = (() => {
    if (!week) return null;
    const nowLocal = new Date();
    return week.employeeSchedules.find((s) => {
      const schedDate = new Date(s.date); // This parses the UTC date string
      // Does this schedule's UTC day match our local day?
      return schedDate.getUTCFullYear() === nowLocal.getFullYear() &&
             schedDate.getUTCMonth() === nowLocal.getMonth() &&
             schedDate.getUTCDate() === nowLocal.getDate();
    }) || null;
  })();

  const weekDays = week
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(week.weekStartDate);
        d.setUTCDate(d.getUTCDate() + i);
        return d;
      })
    : [];

  const getScheduleForDay = (dayIdx: number) => {
    if (!week) return null;
    const target = weekDays[dayIdx];
    return week.employeeSchedules.find((s) => {
      const sd = new Date(s.date);
      return sd.getUTCDate() === target.getUTCDate() && sd.getUTCMonth() === target.getUTCMonth();
    }) ?? null;
  };

  const todayDow = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Schedule</h1>
        <p className="text-slate-500 text-sm mt-0.5">Work schedule and pay history</p>
      </div>

      {/* Today clock in/out */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-blue-400" />
          <span className="font-semibold">Today&apos;s Shift</span>
        </div>
        {!today || today.isDayOff || !today.scheduledStart ? (
          <p className="text-slate-400 text-sm">{!today || !today.scheduledStart ? "No shift scheduled today" : "You have the day off today"}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-slate-400">Scheduled</p>
                <p className="font-mono font-bold text-lg">
                  {formatTime12(today.scheduledStart ?? "")} – {formatTime12(today.scheduledEnd ?? "")}
                </p>
              </div>
              {today.clockIn && (
                <div>
                  <p className="text-xs text-slate-400">Clock In</p>
                  <p className="text-green-400 font-medium text-sm">
                    {new Date(today.clockIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
              {today.clockOut && (
                <div>
                  <p className="text-xs text-slate-400">Clock Out</p>
                  <p className="text-orange-400 font-medium text-sm">
                    {new Date(today.clockOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {!today.clockIn && (
                <button onClick={() => clock("in")} disabled={clocking}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  <LogIn className="w-4 h-4" /> Clock In
                </button>
              )}
              {today.clockIn && !today.clockOut && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => clock("out")} disabled={clocking}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                      <LogOut className="w-4 h-4" /> Clock Out Now
                    </button>
                    <button onClick={() => setShowPreset(p => !p)}
                      className="text-xs text-slate-300 underline underline-offset-2">
                      {showPreset ? "Cancel" : "Set clock-out time"}
                    </button>
                  </div>
                  {showPreset && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-slate-300">Clock out at:</span>
                        <select value={presetHour} onChange={e => setPresetHour(e.target.value)}
                          className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600">
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-slate-400 text-xs">:</span>
                        <select value={presetMin} onChange={e => setPresetMin(e.target.value)}
                          className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600">
                          {["00", "15", "30", "45"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={presetAmpm} onChange={e => setPresetAmpm(e.target.value as "AM" | "PM")}
                          className="bg-slate-700 text-white text-xs rounded px-1.5 py-1 border border-slate-600">
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <button onClick={() => clock("out", true)} disabled={clocking}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                        <LogOut className="w-3.5 h-3.5" /> Confirm Clock-Out Time
                      </button>
                    </div>
                  )}
                </div>
              )}
              {today.clockIn && today.clockOut && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" /> Shift complete
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Current week schedule */}
      {week && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            This Week
          </h2>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const s = getScheduleForDay(i);
              const isToday = i === todayDow;
              return (
                <div key={i} className={`rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center text-[10px] sm:text-xs ${
                  isToday ? "bg-blue-600 text-white" :
                  s?.isDayOff ? "bg-slate-100 text-slate-400" :
                  s?.scheduledStart ? "bg-white border border-slate-200 text-slate-700" :
                  "bg-slate-50 text-slate-300"
                }`}>
                  <div className="font-semibold mb-1">{DAYS[i]}</div>
                  <div className={`text-[10px] ${isToday ? "text-blue-200" : "text-slate-400"}`}>
                    {weekDays[i]?.getUTCDate()}
                  </div>
                  {s?.isDayOff ? (
                    <div className="mt-1 font-medium">OFF</div>
                  ) : s?.scheduledStart ? (
                    <div className="mt-1 leading-tight">
                      <div>{formatTime12(s.scheduledStart)}</div>
                      <div className={isToday ? "text-blue-200" : "text-slate-300"}>–</div>
                      <div>{formatTime12(s.scheduledEnd ?? "")}</div>
                    </div>
                  ) : (
                    <div className="mt-1">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* This week earned so far */}
      {(data?.clockedHoursThisWeek ?? 0) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Earned This Week So Far</p>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-2xl font-bold text-emerald-700">
                {data?.estimatedEarningsThisWeek != null ? `$${data.estimatedEarningsThisWeek.toFixed(2)}` : "—"}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">{data?.clockedHoursThisWeek}h clocked (completed shifts only)</p>
            </div>
            <p className="text-xs text-slate-400">Final amount confirmed by manager</p>
          </div>
        </div>
      )}

      {/* Week-wise pay history */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Pay by Week
        </h2>
        {!data?.payWeeks?.length ? (
          <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">No pay data yet.</div>
        ) : (
          <div className="space-y-2">
            {data.payWeeks.map((w) => (
              <div key={w.weekId} className={`border rounded-xl p-4 flex items-center justify-between gap-3 ${
                w.isPaid ? "bg-white border-slate-200" : "bg-amber-50 border-amber-200"
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">
                      {new Date(w.weekStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                      {" – "}
                      {new Date(w.weekEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                    {w.isCurrentWeek && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">This week</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{w.clockedHours}h clocked</p>
                  {w.notes && <p className="text-xs text-slate-400 mt-0.5">{w.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-lg text-slate-800">
                    ${(w.isPaid && w.confirmedAmount != null ? w.confirmedAmount : w.estimatedAmount).toFixed(2)}
                  </p>
                  {w.isPaid ? (
                    <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                      <CheckCircle className="w-3 h-3" />
                      {w.paidAt ? new Date(w.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Paid"}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 flex items-center gap-1 justify-end">
                      <AlertCircle className="w-3 h-3" /> Pending
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
