"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Settings, DollarSign,
  Clock, CheckCircle, X, Edit2, LogIn, LogOut, Eye, EyeOff
} from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Convert "HH:mm" (24hr) to { hour: 1-12, minute: "00"/"30", ampm: "AM"/"PM" }
function to12hr(time: string) {
  if (!time) return { hour: 6, minute: "00", ampm: "AM" };
  const [h, m] = time.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour, minute: String(m).padStart(2, "0"), ampm };
}

// Convert back to "HH:mm"
function to24hr(hour: number, minute: string, ampm: string) {
  let h = hour;
  if (ampm === "AM" && hour === 12) h = 0;
  if (ampm === "PM" && hour !== 12) h = hour + 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { hour, minute, ampm } = to12hr(value);
  const update = (h: number, m: string, ap: string) => onChange(to24hr(h, m, ap));
  return (
    <div className="flex gap-1">
      <select value={hour} onChange={(e) => update(Number(e.target.value), minute, ampm)}
        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select value={minute} onChange={(e) => update(hour, e.target.value, ampm)}
        className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
        {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={ampm} onChange={(e) => update(hour, minute, e.target.value)}
        className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime12(t: string) {
  if (!t) return "";
  if (t === "00:00") return "12am";
  const [h, m] = t.split(":").map(Number);
  const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  if (h === 0) return `12${mStr}am`;
  if (h === 12) return `12${mStr}pm`;
  return h > 12 ? `${h - 12}${mStr}pm` : `${h}${mStr}am`;
}

function formatDateTime(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

interface ShopHour { id: string; dayOfWeek: number; openTime: string; closeTime: string; }
interface WageOverride { hourSlot: number; customWage: number; reason?: string; }
interface EmployeeSchedule {
  id: string; userId: string; date: string; scheduledStart: string | null;
  scheduledEnd: string | null; isDayOff: boolean; clockIn: string | null;
  clockOut: string | null; notes: string | null; wageOverrides: WageOverride[];
  user: { id: string; name: string; role: string };
}
interface WeekData {
  id: string; weekStartDate: string; weekEndDate: string;
  visibleToEmployees: boolean;
  employeeSchedules: EmployeeSchedule[];
  paySummaries: { userId: string; totalHours: number; totalAmount: number; isPaid: boolean; paidAt: string | null; notes: string | null; user: { id: string; name: string } }[];
}
interface PaySummary {
  id: string; userId: string; totalHours: number; totalAmount: number;
  isPaid: boolean; paidAt: string | null; notes: string | null; hourlyRate: number;
  scheduledHours: number; additionalHours: number; additionalAmount: number;
  user: { id: string; name: string };
}

export default function SchedulePage() {
  const { success, error: showError } = useToast();
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [editModal, setEditModal] = useState<{ schedule: EmployeeSchedule; dayIdx: number } | null>(null);
  const [shopHoursModal, setShopHoursModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [payingUserId, setPayingUserId] = useState<string | null>(null);
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());

  function toggleEmp(id: string) {
    setExpandedEmps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toLocalDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const weekKey = toLocalDateStr(currentMonday);

  const { data: weeksData, mutate: mutateWeeks } = useSWR<{ weeks: { id: string; weekStartDate: string; visibleToEmployees: boolean }[] }>("/api/schedule", fetcher);
  const { data: shopData, mutate: mutateShop } = useSWR<{ hours: ShopHour[] }>("/api/schedule/shop-hours", fetcher);

  const currentWeek = weeksData?.weeks.find((w) => w.weekStartDate.startsWith(weekKey));

  const { data: weekData, mutate: mutateWeek } = useSWR<{ week: WeekData; currentRates: Record<string, number> }>(
    currentWeek ? `/api/schedule/${currentWeek.id}` : null,
    fetcher
  );

  const { data: payData, mutate: mutatePay } = useSWR<{ summaries: PaySummary[] }>(
    payModal && currentWeek ? `/api/payroll/${currentWeek.id}` : null,
    fetcher
  );

  // Group schedules: userId → day index (0-6)
  const scheduleMap = useMemo(() => {
    const map: Record<string, Record<number, EmployeeSchedule>> = {};
    if (!weekData?.week) return map;
    for (const s of weekData.week.employeeSchedules) {
      const date = new Date(s.date);
      const dow = (date.getUTCDay() + 6) % 7; // Mon=0
      if (!map[s.userId]) map[s.userId] = {};
      map[s.userId][dow] = s;
    }
    return map;
  }, [weekData]);

  const employees = useMemo(() => {
    if (!weekData?.week) return [];
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const s of weekData.week.employeeSchedules) {
      if (!seen.has(s.userId)) {
        seen.add(s.userId);
        list.push(s.user);
      }
    }
    return list;
  }, [weekData]);

  const totalWeeklyScheduledHours = useMemo(() => {
    if (!weekData?.week) return 0;
    let total = 0;
    for (const s of weekData.week.employeeSchedules) {
      if (s.isDayOff || !s.scheduledStart || !s.scheduledEnd) continue;
      const sh = parseInt(s.scheduledStart.split(":")[0]);
      const eh = s.scheduledEnd === "00:00" ? 24 : parseInt(s.scheduledEnd.split(":")[0]);
      total += Math.max(0, eh - sh);
    }
    return total;
  }, [weekData]);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    return d;
  });

  async function createWeek(copyFromWeekId?: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDate: toLocalDateStr(currentMonday), copyFromWeekId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success(copyFromWeekId ? "Week created from previous" : "Week created");
      await mutateWeeks();
      await mutateWeek();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  // Find the most recent previous week to copy from
  const previousWeek = weeksData?.weeks.find((w) => w.weekStartDate.slice(0, 10) < weekKey);

  async function saveCell(scheduleId: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/${currentWeek!.id}/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      success("Saved");
      await mutateWeek();
      setEditModal(null);
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(userId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/payroll/${currentWeek!.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paidAt: new Date().toISOString(), notes: payNote }),
      });
      if (!res.ok) throw new Error("Failed");
      success("Marked as paid");
      setPayingUserId(null);
      setPayNote("");
      await mutatePay();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility() {
    if (!currentWeek || !weekData) return;
    const next = !weekData.week.visibleToEmployees;
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/${currentWeek.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibleToEmployees: next }),
      });
      if (!res.ok) throw new Error("Failed");
      success(next ? "Schedule visible to employees" : "Schedule hidden from employees");
      await Promise.all([mutateWeek(), mutateWeeks()]);
    } catch {
      showError("Failed to update visibility");
    } finally {
      setSaving(false);
    }
  }

  async function updateShopHours(dayOfWeek: number, openTime: string, closeTime: string) {
    await fetch("/api/schedule/shop-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayOfWeek, openTime, closeTime }),
    });
    await mutateShop();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Work Schedule</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {formatDateShort(currentMonday)} – {formatDateShort(weekDays[6])}
            {currentWeek && totalWeeklyScheduledHours > 0 && (
              <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {totalWeeklyScheduledHours}h combined
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShopHoursModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            <Settings className="w-4 h-4" /> Shop Hours
          </button>
          {currentWeek && weekData && (
            <button onClick={toggleVisibility} disabled={saving} className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors disabled:opacity-50 ${
              weekData.week.visibleToEmployees
                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}>
              {weekData.week.visibleToEmployees ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {weekData.week.visibleToEmployees ? "Visible" : "Hidden"}
            </button>
          )}
          {currentWeek && (
            <button onClick={() => setPayModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <DollarSign className="w-4 h-4" /> Pay Summary
            </button>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <button onClick={() => setCurrentMonday(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setCurrentMonday(getMonday(new Date()))}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
          This Week
        </button>
        <button onClick={() => setCurrentMonday(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
          className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* No week yet */}
      {!currentWeek && (
        <div className="bg-blue-50 border border-dashed border-blue-200 rounded-2xl p-8 text-center">
          <p className="text-slate-600 mb-4">No schedule created for this week yet.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button onClick={() => createWeek()} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Create Empty
            </button>
            {previousWeek && (
              <button onClick={() => createWeek(previousWeek.id)} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" /> Copy Previous Week
              </button>
            )}
          </div>
        </div>
      )}

      {/* Employee accordion cards */}
      {currentWeek && weekData && (
        <div className="space-y-2">
          {employees.length === 0 && (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-sm">No employees found.</div>
          )}
          {employees.map((emp) => {
            const rate = weekData.currentRates[emp.id];
            const isCollapsed = !expandedEmps.has(emp.id);
            const todayDow = (new Date().getDay() + 6) % 7;
            const empWeekHours = Object.values(scheduleMap[emp.id] ?? {}).reduce((total, s) => {
              if (s.isDayOff || !s.scheduledStart || !s.scheduledEnd) return total;
              const sh = parseInt(s.scheduledStart.split(":")[0]);
              const eh = s.scheduledEnd === "00:00" ? 24 : parseInt(s.scheduledEnd.split(":")[0]);
              return total + Math.max(0, eh - sh);
            }, 0);
            return (
              <div key={emp.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                {/* Employee header */}
                <button
                  onClick={() => toggleEmp(emp.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 text-left">
                      <p className="font-semibold text-slate-800 text-sm truncate">{emp.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {rate ? (
                          <p className="text-xs text-slate-400">${rate}/hr</p>
                        ) : (
                          <p className="text-xs text-red-400">No rate set</p>
                        )}
                        {empWeekHours > 0 && (
                          <p className="text-xs text-slate-400">{empWeekHours}h this week</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                </button>

                {/* Day rows */}
                {!isCollapsed && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const s = scheduleMap[emp.id]?.[dayIdx];
                      const isToday = dayIdx === todayDow;
                      return (
                        <button
                          key={dayIdx}
                          onClick={() => s && setEditModal({ schedule: s, dayIdx })}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isToday ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-xs font-bold w-7 flex-shrink-0 ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                              {DAYS[dayIdx]}
                            </div>
                            <div className={`text-xs ${isToday ? "text-blue-400" : "text-slate-300"}`}>
                              {formatDateShort(weekDays[dayIdx])}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            {s?.isDayOff ? (
                              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">OFF</span>
                            ) : s?.scheduledStart ? (
                              <div className="text-right">
                                <div className="text-xs font-medium text-slate-700">
                                  {formatTime12(s.scheduledStart)} – {formatTime12(s.scheduledEnd ?? "")}
                                </div>
                                {(s.clockIn || s.clockOut) && (
                                  <div className="flex items-center gap-2 justify-end mt-0.5">
                                    {s.clockIn && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-green-600">
                                        <LogIn className="w-2.5 h-2.5" />{formatDateTime(s.clockIn)}
                                      </span>
                                    )}
                                    {s.clockOut && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                                        <LogOut className="w-2.5 h-2.5" />{formatDateTime(s.clockOut)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">Not assigned</span>
                            )}
                            <Edit2 className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Cell Modal */}
      {editModal && (
        <EditCellModal
          schedule={editModal.schedule}
          dayIdx={editModal.dayIdx}
          weekDays={weekDays}
          shopHours={shopData?.hours ?? []}
          onSave={saveCell}
          onClose={() => setEditModal(null)}
          saving={saving}
        />
      )}

      {/* Shop Hours Modal */}
      {shopHoursModal && (
        <ShopHoursModal
          hours={shopData?.hours ?? []}
          onSave={updateShopHours}
          onClose={() => setShopHoursModal(false)}
        />
      )}

      {/* Pay Summary Modal */}
      {payModal && currentWeek && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg text-slate-800">Pay Summary</h2>
              <button onClick={() => setPayModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {!payData && <p className="text-slate-400 text-sm text-center py-4">Calculating...</p>}
              {payData && new Date(weekData?.week.weekEndDate ?? 0).getTime() + 6 * 3600000 > Date.now() && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  Week is not over yet — pay is based on clocked hours so far only.
                </div>
              )}
              {payData?.summaries.map((s) => {
                const hasAdditional = s.isPaid && s.additionalAmount > 0;
                const showPayBtn = !s.isPaid || hasAdditional;
                return (
                  <div key={s.userId} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">{s.user.name}</p>
                        <p className="text-xs text-slate-400">{s.totalHours}h clocked × ${s.hourlyRate}/hr</p>
                        {s.scheduledHours !== s.totalHours && (
                          <p className="text-xs text-slate-300">{s.scheduledHours}h scheduled</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-slate-800">${s.totalAmount.toFixed(2)}</p>
                        {s.isPaid && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Paid {s.paidAt ? new Date(s.paidAt).toLocaleDateString() : ""}</p>}
                      </div>
                    </div>
                    {hasAdditional && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 mb-2">
                        +{s.additionalHours}h worked after payment — ${s.additionalAmount.toFixed(2)} unpaid
                      </div>
                    )}
                    {showPayBtn && (
                      payingUserId === s.userId ? (
                        <div className="space-y-2 mt-2">
                          <input
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => markPaid(s.userId)} disabled={saving}
                              className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                              Confirm — Pay ${hasAdditional ? s.additionalAmount.toFixed(2) : s.totalAmount.toFixed(2)}
                            </button>
                            <button onClick={() => setPayingUserId(null)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setPayingUserId(s.userId)}
                          className="w-full mt-1 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                          {hasAdditional ? "Pay Remaining Hours" : "Mark as Paid"}
                        </button>
                      )
                    )}
                    {s.notes && <p className="text-xs text-slate-500 mt-1">Note: {s.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditCellModal({
  schedule, dayIdx, weekDays, shopHours, onSave, onClose, saving
}: {
  schedule: EmployeeSchedule;
  dayIdx: number;
  weekDays: Date[];
  shopHours: ShopHour[];
  onSave: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [isDayOff, setIsDayOff] = useState(schedule.isDayOff);
  const [start, setStart] = useState(schedule.scheduledStart ?? "06:00");
  const [end, setEnd] = useState(schedule.scheduledEnd ?? "23:00");
  const [notes, setNotes] = useState(schedule.notes ?? "");
  const [overrides, setOverrides] = useState<WageOverride[]>(schedule.wageOverrides ?? []);
  const [newHour, setNewHour] = useState("");
  const [newWage, setNewWage] = useState("");
  function parseLocalClock(dt: string | null) {
    if (!dt) return null;
    const d = new Date(dt);
    const h = d.getHours();
    const m = d.getMinutes();
    const roundedM = String(Math.round(m / 5) * 5 % 60).padStart(2, "0");
    return { hour: String(h % 12 || 12), minute: roundedM, ampm: h < 12 ? "AM" : "PM" } as const;
  }
  const ciInit = parseLocalClock(schedule.clockIn);
  const coInit = parseLocalClock(schedule.clockOut);
  const [hasCi, setHasCi] = useState(!!schedule.clockIn);
  const [ciHour, setCiHour] = useState(ciInit?.hour ?? "9");
  const [ciMin, setCiMin] = useState(ciInit?.minute ?? "00");
  const [ciAmpm, setCiAmpm] = useState<"AM" | "PM">(ciInit?.ampm ?? "AM");
  const [hasCo, setHasCo] = useState(!!schedule.clockOut);
  const [coHour, setCoHour] = useState(coInit?.hour ?? "5");
  const [coMin, setCoMin] = useState(coInit?.minute ?? "00");
  const [coAmpm, setCoAmpm] = useState<"AM" | "PM">(coInit?.ampm ?? "PM");

  function buildClockTime(hour: string, min: string, ampm: string) {
    let h = parseInt(hour);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    const d = new Date(schedule.date);
    d.setHours(h, parseInt(min), 0, 0);
    return d.toISOString();
  }

  const shop = shopHours.find((h) => h.dayOfWeek === dayIdx);

  function addOverride() {
    const h = parseInt(newHour);
    const w = parseFloat(newWage);
    if (isNaN(h) || isNaN(w)) return;
    setOverrides((prev) => {
      const filtered = prev.filter((o) => o.hourSlot !== h);
      return [...filtered, { hourSlot: h, customWage: w }];
    });
    setNewHour("");
    setNewWage("");
  }

  function removeOverride(hourSlot: number) {
    setOverrides((prev) => prev.filter((o) => o.hourSlot !== hourSlot));
  }

  function handleSave() {
    onSave(schedule.id, {
      scheduledStart: isDayOff ? null : start || null,
      scheduledEnd: isDayOff ? null : end || null,
      isDayOff,
      notes: notes || null,
      wageOverrides: overrides,
      // Day-off cannot have clock times — always clear them to avoid rounding drift against payment snapshots
      clockIn: isDayOff ? null : (hasCi ? buildClockTime(ciHour, ciMin, ciAmpm) : null),
      clockOut: isDayOff ? null : (hasCo ? buildClockTime(coHour, coMin, coAmpm) : null),
    });
  }

  const hours = useMemo(() => {
    if (!start || !end) return [];
    const s = parseInt(start.split(":")[0]);
    const e = end === "00:00" ? 24 : parseInt(end.split(":")[0]);
    return Array.from({ length: e - s }, (_, i) => s + i);
  }, [start, end]);

  const shopWarning = useMemo(() => {
    if (!shop || isDayOff || !start || !end) return null;
    const toMins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h === 0 && m === 0 ? 24 * 60 : h * 60 + m;
    };
    const shiftStart = toMins(start);
    const shiftEnd = toMins(end);
    const shopOpen = toMins(shop.openTime);
    const shopClose = toMins(shop.closeTime);
    if (shiftStart < shopOpen && shiftEnd > shopClose) return "Shift starts before and ends after shop hours.";
    if (shiftStart < shopOpen) return `Shift starts before shop opens (${formatTime12(shop.openTime)}).`;
    if (shiftEnd > shopClose) return `Shift ends after shop closes (${formatTime12(shop.closeTime)}).`;
    return null;
  }, [shop, isDayOff, start, end]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-slate-800">{schedule.user.name}</h2>
            <p className="text-slate-400 text-sm">{weekDays[dayIdx]?.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Day off toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setIsDayOff(!isDayOff)} className={`w-11 h-6 rounded-full transition-colors ${isDayOff ? "bg-slate-400" : "bg-blue-600"} relative`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isDayOff ? "left-1" : "left-6"}`} />
            </div>
            <span className="text-sm font-medium text-slate-700">{isDayOff ? "Day Off" : "Working"}</span>
          </label>

          {!isDayOff && (
            <>
              {/* Shop hours hint */}
              {shop && <p className="text-xs text-slate-400">Shop hours: {formatTime12(shop.openTime)} – {formatTime12(shop.closeTime)}</p>}
              {shopWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  ⚠ {shopWarning}
                </div>
              )}

              {/* Time inputs */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 font-medium">Start Time</label>
                  <div className="mt-1"><TimeSelect value={start} onChange={setStart} /></div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">End Time</label>
                  <div className="mt-1"><TimeSelect value={end} onChange={setEnd} /></div>
                </div>
              </div>

              {/* Clock in/out override & Wage overrides — unlocked after clock in */}
              {schedule.clockIn ? (
                <>
                  {/* Clock in/out — admin editable override */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-500 font-medium flex items-center gap-1"><LogIn className="w-3 h-3" />Clock In Override</label>
                        <button type="button" onClick={() => setHasCi(p => !p)} className={`text-xs px-2 py-0.5 rounded ${hasCi ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                          {hasCi ? "Set" : "Not set"}
                        </button>
                      </div>
                      {hasCi && (
                        <div className="flex gap-1">
                          <select value={ciHour} onChange={e => setCiHour(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <select value={ciMin} onChange={e => setCiMin(e.target.value)} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={ciAmpm} onChange={e => setCiAmpm(e.target.value as "AM" | "PM")} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            <option>AM</option><option>PM</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-500 font-medium flex items-center gap-1"><LogOut className="w-3 h-3" />Clock Out Override</label>
                        <button type="button" onClick={() => setHasCo(p => !p)} className={`text-xs px-2 py-0.5 rounded ${hasCo ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"}`}>
                          {hasCo ? "Set" : "Not set"}
                        </button>
                      </div>
                      {hasCo && (
                        <div className="flex gap-1">
                          <select value={coHour} onChange={e => setCoHour(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <select value={coMin} onChange={e => setCoMin(e.target.value)} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={coAmpm} onChange={e => setCoAmpm(e.target.value as "AM" | "PM")} className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                            <option>AM</option><option>PM</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wage overrides */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Hour Wage Overrides</p>
                    {overrides.length > 0 && (
                      <div className="space-y-1 mb-3">
                        {overrides.map((o) => (
                          <div key={o.hourSlot} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm">
                            <span className="text-slate-700">{o.hourSlot}:00–{o.hourSlot + 1}:00</span>
                            <span className="font-medium text-yellow-700">${o.customWage.toFixed(2)}</span>
                            <button onClick={() => removeOverride(o.hourSlot)}><X className="w-3.5 h-3.5 text-slate-400" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <select value={newHour} onChange={(e) => setNewHour(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">Hour</option>
                        {hours.map((h) => (
                          <option key={h} value={h}>{h}:00–{h + 1}:00</option>
                        ))}
                      </select>
                      <input type="number" step="0.01" value={newWage} onChange={(e) => setNewWage(e.target.value)}
                        placeholder="$wage" className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                      <button onClick={addOverride} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
                  Clock override and wage adjustments available after employee clocks in.
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Edit2 className="w-4 h-4" /> Save
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopHoursModal({ hours, onSave, onClose }: {
  hours: ShopHour[];
  onSave: (dayOfWeek: number, openTime: string, closeTime: string) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<ShopHour[]>(hours);

  function update(dayOfWeek: number, field: "openTime" | "closeTime", value: string) {
    setLocal((prev) => prev.map((h) => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h));
  }

  function save() {
    for (const h of local) onSave(h.dayOfWeek, h.openTime, h.closeTime);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5" /> Shop Hours</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-4 space-y-4">
          {local.map((h) => (
            <div key={h.dayOfWeek}>
              <p className="text-xs font-bold text-slate-600 mb-1.5">{DAYS[h.dayOfWeek]}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-9 flex-shrink-0">Open</span>
                  <TimeSelect value={h.openTime} onChange={(v) => update(h.dayOfWeek, "openTime", v)} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-9 flex-shrink-0">Close</span>
                  <TimeSelect value={h.closeTime} onChange={(v) => update(h.dayOfWeek, "closeTime", v)} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={save} className="w-full mt-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            Save Shop Hours
          </button>
        </div>
      </div>
    </div>
  );
}
