"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Users,
  Clock,
  Star,
  CheckSquare,
  TrendingUp,
  Coffee,
  Activity,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, formatDurationShort, formatTime, calculateCurrentActiveTime } from "@/lib/utils";
import type { AdminDashboardData } from "@/types";

export default function AdminDashboardPage() {
  const { data, isLoading } = useSWR<AdminDashboardData>("/api/dashboard/admin", fetcher, {
    refreshInterval: 10000,
  });

  if (isLoading || !data) return null;

  const stats = [
    {
      label: "Total Employees",
      value: data?.totalEmployees ?? 0,
      icon: <Users className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
      color: "text-blue-700",
    },
    {
      label: "Active Shifts",
      value: data?.activeShifts ?? 0,
      icon: <Activity className="w-5 h-5 text-green-600" />,
      bg: "bg-green-50",
      color: "text-green-700",
    },
    {
      label: "Pending Reviews",
      value: data?.pendingReviews ?? 0,
      icon: <Star className="w-5 h-5 text-yellow-600" />,
      bg: "bg-yellow-50",
      color: "text-yellow-700",
    },
    {
      label: "Completed Today",
      value: data?.todayCompletedTasks ?? 0,
      icon: <CheckSquare className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50",
      color: "text-purple-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manager Dashboard</h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <p className="text-slate-500 text-sm mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Active Shifts */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Active Shifts</h2>
        {(data?.recentShifts?.length ?? 0) === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No active shifts right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data?.recentShifts.map((shift) => {
              const shiftDuration = Math.floor(
                (Date.now() - new Date(shift.startTime).getTime()) / 1000
              );

              // Get active task with live time
              const activeTaskEntry = data.recentShifts
                .find((s) => s.id === shift.id);

              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-600 font-semibold text-sm">
                          {shift.user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{shift.user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{shift.user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-slate-700">
                        {formatDuration(shiftDuration)}
                      </div>
                      <p className="text-xs text-slate-400">
                        Since {formatTime(shift.startTime)}
                      </p>
                    </div>
                  </div>

                  {/* Productivity bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-3 h-3" />
                        {formatDurationShort(shift.productiveSeconds)} work
                      </span>
                      <span className="flex items-center gap-1 text-orange-600">
                        <Coffee className="w-3 h-3" />
                        {formatDurationShort(shift.personalSeconds)} personal
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                      {(shift.productiveSeconds + shift.personalSeconds) > 0 && (
                        <>
                          <div
                            className="bg-green-500 h-2"
                            style={{
                              width: `${Math.round(
                                (shift.productiveSeconds /
                                  (shift.productiveSeconds + shift.personalSeconds)) *
                                  100
                              )}%`,
                            }}
                          />
                          <div
                            className="bg-orange-400 h-2"
                            style={{
                              width: `${Math.round(
                                (shift.personalSeconds /
                                  (shift.productiveSeconds + shift.personalSeconds)) *
                                  100
                              )}%`,
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500">{shift.totalTasks} tasks</span>
                    {(activeTaskEntry as { activeTask?: { name: string; category: string } } | null)?.activeTask && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-600 font-medium truncate max-w-32">
                          {(activeTaskEntry as { activeTask?: { name: string; category: string } }).activeTask?.name}
                        </span>
                        <Badge
                          variant={
                            (activeTaskEntry as { activeTask?: { name: string; category: string } }).activeTask?.category === "WORK"
                              ? "work"
                              : "personal"
                          }
                        >
                          {(activeTaskEntry as { activeTask?: { name: string; category: string } }).activeTask?.category === "WORK" ? (
                            <span className="flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Work</span>
                          ) : (
                            <span className="flex items-center gap-0.5"><Coffee className="w-2.5 h-2.5" /> Personal</span>
                          )}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending reviews preview */}
      {(data?.pendingReviewTasks?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Pending Reviews
              <Badge variant="pending" className="ml-2">
                {data?.pendingReviewTasks.length}
              </Badge>
            </h2>
            <a
              href="/admin/reviews"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all →
            </a>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Desktop table */}
            <table className="hidden sm:table w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                </tr>
              </thead>
              <tbody>
                {data?.pendingReviewTasks.slice(0, 8).map((task) => (
                  <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{task.user.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{task.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                        {task.category === "WORK" ? "Work" : "Personal"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-600">
                      {formatDuration(task.totalActiveTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile list */}
            <div className="sm:hidden divide-y divide-slate-50">
              {data?.pendingReviewTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500">{task.user.name}</span>
                      <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                        {task.category === "WORK" ? "Work" : "Break"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 font-medium truncate mt-0.5">{task.name}</p>
                  </div>
                  <span className="text-sm font-mono font-semibold text-slate-600 flex-shrink-0">
                    {formatDuration(task.totalActiveTime)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
