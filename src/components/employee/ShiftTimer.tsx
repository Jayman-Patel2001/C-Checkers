"use client";

import { useState, useEffect } from "react";
import { Clock, Square } from "lucide-react";
import { formatDuration, formatTime } from "@/lib/utils";
import { Shift } from "@/types";

interface ShiftTimerProps {
  shift: Shift;
  onEndShift: () => void;
  loading?: boolean;
}

export function ShiftTimer({ shift, onEndShift, loading = false }: ShiftTimerProps) {
  const startMs = new Date(shift.startTime).getTime();
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - startMs) / 1000)
  );

  useEffect(() => {

    const update = () => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    };

    update();
    const interval = setInterval(update, 1000);

    // Re-sync immediately when tab becomes visible again (mobile background throttling)
    const onVisible = () => { if (document.visibilityState === "visible") update(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [shift.startTime]);

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Shift Active</span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Started at {formatTime(shift.startTime)}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-bold font-mono timer-glow text-blue-300">
            {formatDuration(elapsed)}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">Total shift time</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <button
          onClick={onEndShift}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Square className="w-4 h-4" />
          {loading ? "Ending shift..." : "End Shift"}
        </button>
      </div>
    </div>
  );
}
