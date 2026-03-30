"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Coffee, CheckCircle, PauseCircle, Clock } from "lucide-react";
import { formatDuration, getProductivityPercentage, calculateCurrentActiveTime } from "@/lib/utils";
import { TaskEntry } from "@/types";

interface ProductivityStatsProps {
  tasks: TaskEntry[];
  shiftStartTime: string;
}

export function ProductivityStats({ tasks, shiftStartTime }: ProductivityStatsProps) {
  const computeStats = () => {
    const now = Date.now();
    let productive = 0;
    let personal = 0;
    for (const task of tasks) {
      const time = calculateCurrentActiveTime(
        task.totalActiveTime,
        task.activeIntervalStart || null,
        task.status
      );
      if (task.category === "WORK") productive += time;
      else personal += time;
    }
    const shiftDuration = Math.floor(
      (now - new Date(shiftStartTime).getTime()) / 1000
    );
    return { productive, personal, shiftDuration };
  };

  const [stats, setStats] = useState(() => computeStats());

  useEffect(() => {
    const update = () => setStats(computeStats());

    update();
    const interval = setInterval(update, 1000);

    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tasks, shiftStartTime]);

  const { productive, personal, shiftDuration } = stats;
  const productivityPct = getProductivityPercentage(productive, productive + personal);
  const activeTasks = tasks.filter((t) => t.status === "ACTIVE").length;
  const pausedTasks = tasks.filter((t) => t.status === "PAUSED").length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-3">
      {/* Productivity bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-600">Productivity Score</span>
          <span
            className={`text-lg font-bold ${
              productivityPct >= 70
                ? "text-green-600"
                : productivityPct >= 40
                ? "text-yellow-600"
                : "text-red-500"
            }`}
          >
            {productivityPct}%
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-1000 ${
              productivityPct >= 70
                ? "bg-green-500"
                : productivityPct >= 40
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${productivityPct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Productive</span>
          </div>
          <div className="text-lg font-bold text-green-700 font-mono">
            {formatDuration(productive)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center">
              <Coffee className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Personal</span>
          </div>
          <div className="text-lg font-bold text-orange-700 font-mono">
            {formatDuration(personal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Shift Time</span>
          </div>
          <div className="text-lg font-bold text-slate-700 font-mono">
            {formatDuration(shiftDuration)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Tasks Done</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold text-blue-700">{completedTasks}</span>
            {pausedTasks > 0 && (
              <span className="text-xs text-yellow-600 mb-0.5 flex items-center gap-0.5">
                <PauseCircle className="w-3 h-3" />
                {pausedTasks} paused
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
