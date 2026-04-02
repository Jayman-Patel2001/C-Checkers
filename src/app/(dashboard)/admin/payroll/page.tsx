"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useState } from "react";
import { CheckCircle, DollarSign, Clock, ChevronDown, AlertCircle } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface EmployeePay {
  userId: string; name: string; hourlyRate: number;
  clockedHours: number; amount: number;
  isPaid: boolean; paidAt: string | null; notes: string | null;
  paidAmount: number | null;
}
interface WeekRow {
  weekId: string; weekStartDate: string; weekEndDate: string;
  employees: EmployeePay[]; isCurrentWeek: boolean;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function PayrollPage() {
  const { success, error: showError } = useToast();
  const { data, mutate } = useSWR<{ weeks: WeekRow[] }>("/api/payroll", fetcher);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState<{ weekId: string; userId: string } | null>(null);
  const [payNote, setPayNote] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(weekId: string) {
    setCollapsed((p) => { const n = new Set(p); n.has(weekId) ? n.delete(weekId) : n.add(weekId); return n; });
  }

  async function markPaid(weekId: string, userId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/payroll/${weekId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paidAt: new Date().toISOString(), notes: payNote }),
      });
      if (!res.ok) throw new Error("Failed");
      success("Marked as paid");
      setPaying(null);
      setPayNote("");
      await mutate();
      globalMutate("/api/schedule/my");
    } catch {
      showError("Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  }

  const weeks = data?.weeks ?? [];
  const totalPending = weeks.reduce((s, w) => s + w.employees.reduce((a, e) => {
    if (!e.isPaid) return a + e.amount;
    // Partially paid: additional hours worked after payment count as pending
    if (e.paidAmount != null && e.amount > e.paidAmount + 0.01) return a + (e.amount - e.paidAmount);
    return a;
  }, 0), 0);
  const totalPaid = weeks.reduce((s, w) => s + w.employees.filter((e) => e.isPaid).reduce((a, e) => a + (e.paidAmount ?? e.amount), 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
        <p className="text-slate-500 text-sm mt-0.5">Week-wise pay management</p>
      </div>

      {/* Summary bar */}
      {weeks.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-600">Pending</p>
              <p className="font-bold text-amber-700">${totalPending.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-green-600">Paid out</p>
              <p className="font-bold text-green-700">${totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {!data && <p className="text-slate-400 text-sm">Loading...</p>}
      {data && weeks.length === 0 && (
        <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-sm">
          No payroll data yet. Employees need to clock in and out first.
        </div>
      )}

      <div className="space-y-3">
        {weeks.map((week) => {
          const isCollapsed = collapsed.has(week.weekId);
          const weekPending = week.employees.reduce((a, e) => {
            if (!e.isPaid) return a + e.amount;
            if (e.paidAmount != null && e.amount > e.paidAmount + 0.01) return a + (e.amount - e.paidAmount);
            return a;
          }, 0);
          const allPaid = week.employees.every((e) => e.isPaid && (e.paidAmount == null || e.amount <= e.paidAmount + 0.01));
          const isCurrentWeek = week.isCurrentWeek;

          return (
            <div key={week.weekId} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* Week header */}
              <button onClick={() => toggle(week.weekId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">
                      {fmt(week.weekStartDate)} – {fmt(week.weekEndDate)}
                      {isCurrentWeek && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">This week</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {week.employees.length} employee{week.employees.length !== 1 ? "s" : ""}
                      {allPaid
                        ? " · All paid"
                        : ` · $${weekPending.toFixed(2)} pending`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {allPaid
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <DollarSign className="w-4 h-4 text-amber-500" />}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
                </div>
              </button>

              {/* Employee rows */}
              {!isCollapsed && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {isCurrentWeek && (
                    <div className="px-4 py-2 bg-blue-50 text-xs text-blue-600 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Week in progress — pay based on clocked hours so far
                    </div>
                  )}
                  {week.employees.map((emp) => {
                    const isPaying = paying?.weekId === week.weekId && paying?.userId === emp.userId;
                    return (
                      <div key={emp.userId} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                            <p className="text-xs text-slate-400">
                              {emp.clockedHours}h × ${emp.hourlyRate}/hr
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {emp.isPaid && emp.paidAmount != null && emp.amount > emp.paidAmount + 0.01 ? (
                              <>
                                <p className="font-bold text-slate-800">${emp.paidAmount.toFixed(2)}</p>
                                <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                  <CheckCircle className="w-3 h-3" />
                                  {emp.paidAt ? new Date(emp.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Paid"}
                                </p>
                                <p className="text-xs text-amber-600 mt-0.5">+${(emp.amount - emp.paidAmount).toFixed(2)} new hrs</p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold text-slate-800">${emp.amount.toFixed(2)}</p>
                                {emp.isPaid ? (
                                  <p className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                    <CheckCircle className="w-3 h-3" />
                                    {emp.paidAt ? new Date(emp.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Paid"}
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-600">Pending</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {(!emp.isPaid || (emp.isPaid && emp.paidAmount != null && emp.amount > emp.paidAmount + 0.01)) && (
                          isPaying ? (
                            <div className="mt-2 space-y-2">
                              <input value={payNote} onChange={(e) => setPayNote(e.target.value)}
                                placeholder="Note (optional)"
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                              <div className="flex gap-2">
                                <button onClick={() => markPaid(week.weekId, emp.userId)} disabled={saving}
                                  className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                                  Confirm — Pay ${(emp.isPaid && emp.paidAmount != null ? emp.amount - emp.paidAmount : emp.amount).toFixed(2)}
                                </button>
                                <button onClick={() => { setPaying(null); setPayNote(""); }}
                                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setPaying({ weekId: week.weekId, userId: emp.userId })}
                              className="mt-2 w-full py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                              {emp.isPaid ? "Pay Remaining Hours" : "Mark as Paid"}
                            </button>
                          )
                        )}
                        {emp.notes && <p className="text-xs text-slate-400 mt-1">Note: {emp.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
