"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Clock,
  RefreshCw,
  TrendingUp,
  Coffee,
  Users,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, formatDateTime, formatTime } from "@/lib/utils";

interface TaskBreakdown {
  id: string;
  name: string;
  category: string;
  status: string;
  isCustom: boolean;
  totalActiveTime: number;
  startedAt?: string | null;
  completedAt?: string | null;
  reviewStatus?: string | null;
}

interface ShiftStat {
  id: string;
  user: { id: string; name: string; email: string };
  startTime: string;
  endTime?: string | null;
  shiftDurationSeconds: number;
  workSeconds: number;
  personalSeconds: number;
  idleSeconds: number;
  rejectedWorkSeconds: number;
  wastedSeconds: number;
  totalTrackedSeconds: number;
  workPct: number;
  personalPct: number;
  idlePct: number;
  wastedPct: number;
  taskCount: number;
  taskBreakdown: TaskBreakdown[];
}

function WastedLabel({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-green-600 font-semibold text-sm">None</span>;
  if (pct <= 15) return <span className="text-yellow-600 font-semibold text-sm">Low ({pct}%)</span>;
  if (pct <= 30) return <span className="text-orange-600 font-semibold text-sm">Moderate ({pct}%)</span>;
  return <span className="text-red-600 font-semibold text-sm">High ({pct}%)</span>;
}

function toDateKey(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function formatDayLabel(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00");
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateKey === today.toLocaleDateString("en-CA")) return "Today";
  if (dateKey === yesterday.toLocaleDateString("en-CA")) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function ShiftsPage() {
  const [userFilter, setUserFilter] = useState<string>("");
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());
  const todayKey = new Date().toLocaleDateString("en-CA");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([todayKey]));

  const { data, isLoading, mutate } = useSWR<{ shifts: ShiftStat[] }>(
    "/api/admin/shifts",
    fetcher
  );
  const shifts = data?.shifts || [];

  const toggleShift = (id: string) => {
    setExpandedShifts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const uniqueEmployees = Array.from(
    new Map(shifts.map((s) => [s.user.id, s.user])).values()
  );

  // Group filtered shifts by day
  const filteredShifts = userFilter ? shifts.filter((s) => s.user.id === userFilter) : shifts;
  const shiftsByDay = filteredShifts.reduce<Record<string, ShiftStat[]>>((acc, shift) => {
    const key = toDateKey(shift.startTime);
    if (!acc[key]) acc[key] = [];
    acc[key].push(shift);
    return acc;
  }, {});
  const dayKeys = Object.keys(shiftsByDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Shift Reports</h1>
        <p className="text-slate-500 mt-1">
          Work time, personal breaks, idle time and total wasted time per shift
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {uniqueEmployees.length > 1 && (
          <>
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="input-field py-1.5 text-sm flex-1 sm:w-44 sm:flex-none"
            >
              <option value="">All employees</option>
              {uniqueEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </>
        )}
        <button onClick={() => mutate()} className="btn-secondary py-1.5 flex items-center gap-1.5 text-sm ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {isLoading ? null : filteredShifts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500">No shifts this week</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayKeys.map((dayKey) => {
            const dayShifts = shiftsByDay[dayKey];
            const isDayOpen = expandedDays.has(dayKey);

            return (
              <div key={dayKey} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Day header */}
                <button
                  onClick={() => toggleDay(dayKey)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 text-sm">{formatDayLabel(dayKey)}</span>
                    <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                      {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                    </span>
                    {dayShifts.some(s => !s.endTime) && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </div>
                  {isDayOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {/* Shifts for this day */}
                {isDayOpen && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {dayShifts.map((shift) => {
            const isExpanded = expandedShifts.has(shift.id);
            const isActive = !shift.endTime;

            return (
              <div key={shift.id} className="overflow-hidden">
                <div className="p-4 sm:p-5">
                  {/* Employee + timing */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? "bg-green-100" : "bg-slate-100"}`}>
                        <span className={`font-semibold text-sm ${isActive ? "text-green-700" : "text-slate-600"}`}>
                          {shift.user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm">{shift.user.name}</p>
                          <Badge variant={isActive ? "active" : "completed"}>
                            {isActive ? "Active" : "Ended"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {formatDateTime(shift.startTime)}
                          {shift.endTime && ` → ${formatTime(shift.endTime)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400 mb-0.5">Total</p>
                      <p className="text-lg font-bold font-mono text-slate-700">
                        {formatDuration(shift.shiftDurationSeconds)}
                      </p>
                    </div>
                  </div>

                  {/* stat cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    {/* Productive */}
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex sm:block items-center gap-3">
                      <div className="flex items-center gap-1.5 sm:mb-2 flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Productive</span>
                      </div>
                      <div className="flex items-center justify-between flex-1 sm:block">
                        <p className="text-lg font-bold text-green-700 font-mono leading-none">
                          {formatDuration(shift.workSeconds)}
                        </p>
                        <div className="flex items-center gap-2 sm:mt-1.5">
                          <span className="text-xs text-green-600">
                            {shift.taskBreakdown.filter((t) => t.category === "WORK").length} tasks
                          </span>
                          <span className="text-sm font-bold text-green-600">{shift.workPct}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Personal breaks */}
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex sm:block items-center gap-3">
                      <div className="flex items-center gap-1.5 sm:mb-2 flex-shrink-0">
                        <Coffee className="w-4 h-4 text-orange-600" />
                        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Breaks</span>
                      </div>
                      <div className="flex items-center justify-between flex-1 sm:block">
                        <p className="text-lg font-bold text-orange-700 font-mono leading-none">
                          {formatDuration(shift.personalSeconds)}
                        </p>
                        <div className="flex items-center gap-2 sm:mt-1.5">
                          <span className="text-xs text-orange-600">
                            {shift.taskBreakdown.filter((t) => t.category === "PERSONAL").length} tasks
                          </span>
                          <span className="text-sm font-bold text-orange-600">{shift.personalPct}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Wasted */}
                    <div className={`border rounded-xl p-3 flex sm:block items-start gap-3 ${
                      shift.wastedPct === 0
                        ? "bg-slate-50 border-slate-100"
                        : shift.wastedPct <= 15
                        ? "bg-yellow-50 border-yellow-100"
                        : shift.wastedPct <= 30
                        ? "bg-orange-50 border-orange-200"
                        : "bg-red-50 border-red-200"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className={`w-4 h-4 ${
                          shift.wastedPct === 0 ? "text-slate-400"
                          : shift.wastedPct <= 15 ? "text-yellow-500"
                          : shift.wastedPct <= 30 ? "text-orange-500"
                          : "text-red-500"
                        }`} />
                        <span className={`text-xs font-semibold uppercase tracking-wide ${
                          shift.wastedPct === 0 ? "text-slate-500"
                          : shift.wastedPct <= 15 ? "text-yellow-700"
                          : shift.wastedPct <= 30 ? "text-orange-700"
                          : "text-red-700"
                        }`}>Wasted</span>
                      </div>
                      <p className={`text-xl font-bold font-mono leading-none ${
                        shift.wastedPct === 0 ? "text-slate-500"
                        : shift.wastedPct <= 15 ? "text-yellow-700"
                        : shift.wastedPct <= 30 ? "text-orange-700"
                        : "text-red-700"
                      }`}>
                        {formatDuration(shift.wastedSeconds)}
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            Breaks: {formatDuration(shift.personalSeconds)}
                          </span>
                          <span className={`font-bold ${
                            shift.wastedPct === 0 ? "text-slate-400"
                            : shift.wastedPct <= 15 ? "text-yellow-600"
                            : shift.wastedPct <= 30 ? "text-orange-600"
                            : "text-red-600"
                          }`}>{shift.wastedPct}%</span>
                        </div>
                        {shift.rejectedWorkSeconds > 0 && (
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <MinusCircle className="w-3 h-3" />
                            Rejected: {formatDuration(shift.rejectedWorkSeconds)}
                          </div>
                        )}
                        {shift.idleSeconds > 0 && (
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <MinusCircle className="w-3 h-3" />
                            Idle: {formatDuration(shift.idleSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stacked bar: green = work, orange = personal, red = idle */}
                  <div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                      {shift.workPct > 0 && (
                        <div
                          className="bg-green-500 h-full transition-all"
                          style={{ width: `${shift.workPct}%` }}
                          title={`Work: ${formatDuration(shift.workSeconds)}`}
                        />
                      )}
                      {shift.personalPct > 0 && (
                        <div
                          className="bg-orange-400 h-full transition-all"
                          style={{ width: `${shift.personalPct}%` }}
                          title={`Personal: ${formatDuration(shift.personalSeconds)}`}
                        />
                      )}
                      {shift.idlePct > 0 && (
                        <div
                          className="bg-red-300 h-full transition-all"
                          style={{ width: `${shift.idlePct}%` }}
                          title={`Idle: ${formatDuration(shift.idleSeconds)}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                        Work {shift.workPct}%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
                        Breaks {shift.personalPct}%
                      </span>
                      {shift.idleSeconds > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" />
                          Idle {shift.idlePct}%
                        </span>
                      )}
                      <span className="ml-auto font-medium">
                        Wasted: <WastedLabel pct={shift.wastedPct} />
                      </span>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  {shift.taskBreakdown.length > 0 && (
                    <button
                      onClick={() => toggleShift(shift.id)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? "Hide" : "Show"} task breakdown ({shift.taskCount})
                    </button>
                  )}
                </div>

                {/* Task breakdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Desktop header — hidden on mobile */}
                    <div className="hidden sm:grid px-5 py-2 bg-slate-50 grid-cols-12 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      <span className="col-span-5">Task</span>
                      <span className="col-span-2 text-center">Type</span>
                      <span className="col-span-2 text-center">Time</span>
                      <span className="col-span-1 text-center">%</span>
                      <span className="col-span-2 text-center">Review</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {shift.taskBreakdown
                        .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""))
                        .map((task) => {
                          const pctOfShift = shift.shiftDurationSeconds > 0
                            ? Math.round((task.totalActiveTime / shift.shiftDurationSeconds) * 100)
                            : 0;
                          return (
                            <div key={task.id}>
                              {/* Desktop row */}
                              <div className="hidden sm:grid px-5 py-3 grid-cols-12 items-center">
                                <div className="col-span-5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                      task.category === "WORK" ? "bg-blue-50" : "bg-orange-50"
                                    }`}>
                                      {task.category === "WORK"
                                        ? <Zap className="w-3 h-3 text-blue-500" />
                                        : <Coffee className="w-3 h-3 text-orange-500" />
                                      }
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm text-slate-700 truncate">{task.name}</p>
                                      {task.startedAt && (
                                        <p className="text-xs text-slate-400">
                                          {formatTime(task.startedAt)}
                                          {task.completedAt && ` → ${formatTime(task.completedAt)}`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="col-span-2 text-center">
                                  <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                                    {task.category === "WORK" ? "Work" : "Break"}
                                  </Badge>
                                </div>
                                <div className="col-span-2 text-center font-mono text-sm font-semibold text-slate-700">
                                  {formatDuration(task.totalActiveTime)}
                                </div>
                                <div className="col-span-1 text-center text-xs text-slate-500">
                                  {pctOfShift}%
                                </div>
                                <div className="col-span-2 text-center">
                                  {task.status === "COMPLETED" ? (
                                    task.reviewStatus ? (
                                      <Badge variant={task.reviewStatus === "APPROVED" ? "approved" : "rejected"}>
                                        {task.reviewStatus === "APPROVED" ? "Approved" : "Rejected"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="pending">Pending</Badge>
                                    )
                                  ) : (
                                    <Badge variant={task.status === "ACTIVE" ? "active" : task.status === "PAUSED" ? "paused" : "default"}>
                                      {task.status.toLowerCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {/* Mobile card */}
                              <div className="sm:hidden px-4 py-3 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    task.category === "WORK" ? "bg-blue-50" : "bg-orange-50"
                                  }`}>
                                    {task.category === "WORK"
                                      ? <Zap className="w-3.5 h-3.5 text-blue-500" />
                                      : <Coffee className="w-3.5 h-3.5 text-orange-500" />
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm text-slate-700 font-medium leading-snug">{task.name}</p>
                                    {task.startedAt && (
                                      <p className="text-xs text-slate-400 mt-0.5">
                                        {formatTime(task.startedAt)}{task.completedAt && ` → ${formatTime(task.completedAt)}`}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                                        {task.category === "WORK" ? "Work" : "Break"}
                                      </Badge>
                                      {task.status === "COMPLETED" ? (
                                        task.reviewStatus ? (
                                          <Badge variant={task.reviewStatus === "APPROVED" ? "approved" : "rejected"}>
                                            {task.reviewStatus === "APPROVED" ? "✓" : "✗"}
                                          </Badge>
                                        ) : (
                                          <Badge variant="pending">Pending</Badge>
                                        )
                                      ) : (
                                        <Badge variant={task.status === "ACTIVE" ? "active" : task.status === "PAUSED" ? "paused" : "default"}>
                                          {task.status.toLowerCase()}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="font-mono text-sm font-semibold text-slate-700">{formatDuration(task.totalActiveTime)}</p>
                                  <p className="text-xs text-slate-400">{pctOfShift}%</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Totals</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-700 font-mono">{formatDuration(shift.totalTrackedSeconds)}</span>
                        <span className="text-slate-500">
                          {shift.shiftDurationSeconds > 0 ? Math.round((shift.totalTrackedSeconds / shift.shiftDurationSeconds) * 100) : 0}%
                        </span>
                        {shift.idleSeconds > 0 && (
                          <span className="text-red-500">+{formatDuration(shift.idleSeconds)} idle</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
