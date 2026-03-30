"use client";

import { useState, useEffect } from "react";
import { Pause, CheckCircle, Zap, Coffee } from "lucide-react";
import { formatDuration, calculateCurrentActiveTime } from "@/lib/utils";
import { TaskEntry } from "@/types";
import { Badge } from "@/components/ui/Badge";

interface ActiveTaskCardProps {
  task: TaskEntry;
  onPause: (taskId: string) => Promise<void>;
  onComplete: (taskId: string) => Promise<void>;
  loading?: boolean;
}

export function ActiveTaskCard({
  task,
  onPause,
  onComplete,
  loading = false,
}: ActiveTaskCardProps) {
  const [displayTime, setDisplayTime] = useState(() =>
    calculateCurrentActiveTime(
      task.totalActiveTime,
      task.activeIntervalStart || null,
      task.status
    )
  );

  useEffect(() => {
    const update = () => {
      setDisplayTime(
        calculateCurrentActiveTime(
          task.totalActiveTime,
          task.activeIntervalStart || null,
          task.status
        )
      );
    };

    update();
    const interval = setInterval(update, 1000);

    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [task.totalActiveTime, task.activeIntervalStart, task.status]);

  const isWork = task.category === "WORK";

  return (
    <div
      className={`rounded-2xl p-5 border-2 ${
        isWork
          ? "bg-gradient-to-br from-blue-50 to-white border-blue-200"
          : "bg-gradient-to-br from-orange-50 to-white border-orange-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isWork ? "bg-blue-100" : "bg-orange-100"
            }`}
          >
            {isWork ? (
              <Zap className="w-5 h-5 text-blue-600" />
            ) : (
              <Coffee className="w-5 h-5 text-orange-600" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-800 truncate">{task.name}</h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-600 text-xs font-medium">Running</span>
              </div>
            </div>
            {task.description && (
              <p className="text-slate-500 text-sm mt-0.5 truncate">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant={isWork ? "work" : "personal"}>
                {isWork ? "Work" : "Personal"}
              </Badge>
              {task.isCustom && (
                <Badge variant="default">Custom</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div
            className={`text-2xl font-bold font-mono ${
              isWork ? "text-blue-700" : "text-orange-700"
            }`}
          >
            {formatDuration(displayTime)}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">active time</p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onPause(task.id)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Pause className="w-4 h-4" />
          Pause
        </button>
        <button
          onClick={() => onComplete(task.id)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Complete
        </button>
      </div>
    </div>
  );
}
