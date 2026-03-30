"use client";

import { Play, CheckCircle, Zap, Coffee, Clock, Star } from "lucide-react";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { TaskEntry } from "@/types";
import { Badge } from "@/components/ui/Badge";

interface PausedTaskCardProps {
  task: TaskEntry;
  onResume: (taskId: string) => Promise<void>;
  onComplete: (taskId: string) => Promise<void>;
  loading?: boolean;
}

export function PausedTaskCard({
  task,
  onResume,
  onComplete,
  loading = false,
}: PausedTaskCardProps) {
  const isWork = task.category === "WORK";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isWork ? "bg-blue-50" : "bg-orange-50"
            }`}
          >
            {isWork ? (
              <Zap className="w-4 h-4 text-blue-500" />
            ) : (
              <Coffee className="w-4 h-4 text-orange-500" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-slate-700 truncate">{task.name}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="paused">Paused</Badge>
              <Badge variant={isWork ? "work" : "personal"}>
                {isWork ? "Work" : "Personal"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold text-slate-700">
            {formatDuration(task.totalActiveTime)}
          </div>
          <p className="text-slate-400 text-xs">saved time</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onResume(task.id)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <Play className="w-3 h-3" />
          Resume
        </button>
        <button
          onClick={() => onComplete(task.id)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCircle className="w-3 h-3" />
          Complete
        </button>
      </div>
    </div>
  );
}

interface CompletedTaskCardProps {
  task: TaskEntry;
}

export function CompletedTaskCard({ task }: CompletedTaskCardProps) {
  const isWork = task.category === "WORK";
  const review = task.review;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-50">
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-slate-600 truncate">{task.name}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="completed">Completed</Badge>
              <Badge variant={isWork ? "work" : "personal"}>
                {isWork ? "Work" : "Personal"}
              </Badge>
              {review ? (
                <Badge variant={review.status === "APPROVED" ? "approved" : "rejected"}>
                  {review.status === "APPROVED" ? "Approved" : "Rejected"}
                </Badge>
              ) : (
                <Badge variant="pending">Pending Review</Badge>
              )}
            </div>
            {review?.comment && (
              <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Star className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Manager comment</span>
                </div>
                <p className="text-xs text-slate-600">{review.comment}</p>
              </div>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-semibold text-slate-600">
            {formatDuration(task.totalActiveTime)}
          </div>
          {task.completedAt && (
            <div className="flex items-center gap-1 justify-end mt-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-400">
                {formatDateTime(task.completedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
