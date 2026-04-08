"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Users,
  Clock,
  Star,
  CheckSquare,
  Activity,
  LogIn,
} from "lucide-react";
import { formatDuration, formatTime } from "@/lib/utils";
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

      {/* Clocked In */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Clocked In</h2>
        {(data?.clockedInEmployees?.length ?? 0) === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No one is clocked in right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data?.clockedInEmployees.map((emp) => {
              const elapsed = Math.floor(
                (Date.now() - new Date(emp.clockIn).getTime()) / 1000
              );
              return (
                <div key={emp.scheduleId} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 font-semibold text-sm">
                          {emp.user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{emp.user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.user.email}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-mono font-bold text-green-700">
                        {formatDuration(elapsed)}
                      </div>
                      <p className="text-xs text-slate-400">elapsed</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <LogIn className="w-3 h-3 text-green-500" />
                      Clocked in {formatTime(emp.clockIn)}
                    </span>
                    {emp.scheduledStart && emp.scheduledEnd && (
                      <span className="text-slate-400">
                        Scheduled {emp.scheduledStart} – {emp.scheduledEnd}
                      </span>
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
