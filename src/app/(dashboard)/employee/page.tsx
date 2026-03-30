"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import {
  Plus,
  Coffee,
  Play,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  TrendingUp,
  Star,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { ShiftTimer } from "@/components/employee/ShiftTimer";
import { ActiveTaskCard } from "@/components/employee/ActiveTaskCard";
import { PausedTaskCard, CompletedTaskCard } from "@/components/employee/TaskCard";
import { ProductivityStats } from "@/components/employee/ProductivityStats";
import { CreateTaskModal } from "@/components/employee/CreateTaskModal";
import { ConfirmModal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDuration } from "@/lib/utils";
import type { EmployeeDashboardData, TaskEntry, TaskDefinition, LastShiftReview } from "@/types";

export default function EmployeeDashboardPage() {
  const { data: session } = useSession();
  const { success, error: showError, warning } = useToast();

  const [actionLoading, setActionLoading] = useState(false);
  const [showWorkDefs, setShowWorkDefs] = useState(true);
  const [showPersonalDefs, setShowPersonalDefs] = useState(true);
  const [showPaused, setShowPaused] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Modals
  const [createModal, setCreateModal] = useState<{
    open: boolean;
    type: "custom-work" | "personal";
  }>({ open: false, type: "custom-work" });

  const [conflictModal, setConflictModal] = useState<{
    open: boolean;
    pendingAction: (() => Promise<void>) | null;
    message: string;
  }>({ open: false, pendingAction: null, message: "" });

  const [endShiftModal, setEndShiftModal] = useState(false);

  const { data, mutate } = useSWR<EmployeeDashboardData>("/api/dashboard/employee", fetcher, {
    refreshInterval: 8000,
  });

  const handleStartTask = async (
    taskDef: TaskDefinition,
    pauseCurrent = false
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDefinitionId: taskDef.id,
          name: taskDef.name,
          description: taskDef.description,
          category: taskDef.category,
          isCustom: false,
          pauseCurrentTask: pauseCurrent,
        }),
      });

      const json = await res.json();

      if (res.status === 409 && json.error === "TASK_ALREADY_ACTIVE") {
        setConflictModal({
          open: true,
          message: `"${json.activeTask?.name}" is currently running. Pause it and start "${taskDef.name}"?`,
          pendingAction: () => handleStartTask(taskDef, true),
        });
        return;
      }

      if (!res.ok) throw new Error(json.error || "Failed");

      success(`Started: ${taskDef.name}`);
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to start task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTask = async (formData: {
    name: string;
    description?: string;
    category: "WORK" | "PERSONAL";
    isCustom: boolean;
    taskDefinitionId?: string;
  }) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, pauseCurrentTask: false }),
      });

      const json = await res.json();

      if (res.status === 409 && json.error === "TASK_ALREADY_ACTIVE") {
        setCreateModal({ open: false, type: createModal.type });
        setConflictModal({
          open: true,
          message: `"${json.activeTask?.name}" is currently running. Pause it and start "${formData.name}"?`,
          pendingAction: async () => {
            const res2 = await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...formData, pauseCurrentTask: true }),
            });
            if (!res2.ok) {
              const j = await res2.json();
              throw new Error(j.error || "Failed");
            }
            success(`Started: ${formData.name}`);
            await mutate();
          },
        });
        return;
      }

      if (!res.ok) throw new Error(json.error || "Failed");

      success(`Started: ${formData.name}`);
      setCreateModal({ open: false, type: createModal.type });
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to start task");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed");
      }
      warning("Task paused");
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to pause task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeTask = async (taskId: string, pauseCurrent = false) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", pauseCurrentTask: pauseCurrent }),
      });
      const json = await res.json();

      if (res.status === 409 && json.error === "TASK_ALREADY_ACTIVE") {
        const taskName = data?.pausedTasks.find((t) => t.id === taskId)?.name;
        setConflictModal({
          open: true,
          message: `"${json.activeTask?.name}" is running. Pause it and resume "${taskName}"?`,
          pendingAction: () => handleResumeTask(taskId, true),
        });
        return;
      }

      if (!res.ok) throw new Error(json.error || "Failed");

      success("Task resumed");
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to resume task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed");
      }
      success("Task completed!");
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to complete task");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndShift = async (force = false) => {
    if (!data?.activeShift) return;

    if (data.activeTask && !force) {
      setEndShiftModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/shifts/${data.activeShift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceEnd: force }),
      });

      const json = await res.json();

      if (res.status === 400 && json.error === "TASK_RUNNING" && !force) {
        setEndShiftModal(true);
        return;
      }

      if (!res.ok) throw new Error(json.error || "Failed");

      success("Shift ended successfully");
      setEndShiftModal(false);
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to end shift");
    } finally {
      setActionLoading(false);
    }
  };

  if (!data) return null;

  const taskDefs = data?.taskDefinitions || [];
  const workDefs = taskDefs.filter((t) => t.category === "WORK");
  const personalDefs = taskDefs.filter((t) => t.category === "PERSONAL");

  // Track which task definitions have been completed this shift
  const completedDefIds = new Set(
    (data?.completedTasks || [])
      .filter((t) => t.taskDefinitionId)
      .map((t) => t.taskDefinitionId as string)
  );
  const allWorkDone =
    workDefs.length > 0 && workDefs.every((def) => completedDefIds.has(def.id));

  const allTasks: TaskEntry[] = [
    ...(data?.activeTask ? [data.activeTask] : []),
    ...(data?.pausedTasks || []),
    ...(data?.completedTasks || []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Good {getGreeting()}, {session?.user.name?.split(" ")[0]}!
        </h1>
        <p className="text-slate-500 mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* No active shift */}
      {!data?.activeShift && (
        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-dashed border-blue-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Play className="w-7 h-7 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">
            Ready to start your shift?
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Select a task below to automatically begin your shift.
          </p>
        </div>
      )}

      {/* Last shift review — visible between shifts */}
      {!data?.activeShift && data?.lastShiftReview && (
        <LastShiftReviewPanel review={data.lastShiftReview} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Task selection + active/paused/completed */}
        <div className="xl:col-span-2 space-y-5">
          {/* Shift timer */}
          {data?.activeShift && (
            <ShiftTimer
              shift={data.activeShift}
              onEndShift={() => handleEndShift(false)}
              loading={actionLoading}
            />
          )}

          {/* Active task */}
          {data?.activeTask && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5">
                Active Task
              </h2>
              <ActiveTaskCard
                task={data.activeTask}
                onPause={handlePauseTask}
                onComplete={handleCompleteTask}
                loading={actionLoading}
              />
            </div>
          )}

          {/* Paused tasks */}
          {(data?.pausedTasks?.length ?? 0) > 0 && (
            <div>
              <button
                onClick={() => setShowPaused(!showPaused)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5 w-full"
              >
                <span>Paused Tasks</span>
                <Badge variant="paused">{data?.pausedTasks.length}</Badge>
                <span className="ml-auto">
                  {showPaused ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {showPaused && (
                <div className="space-y-2">
                  {data?.pausedTasks.map((task) => (
                    <PausedTaskCard
                      key={task.id}
                      task={task}
                      onResume={handleResumeTask}
                      onComplete={handleCompleteTask}
                      loading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed tasks */}
          {(data?.completedTasks?.length ?? 0) > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5 w-full"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Completed This Shift</span>
                <Badge variant="completed">{data?.completedTasks.length}</Badge>
                <span className="ml-auto">
                  {showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>
              {showCompleted && (
                <div className="space-y-2">
                  {data?.completedTasks.map((task) => (
                    <CompletedTaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Work task definitions */}
          <div className={allWorkDone ? "opacity-40 transition-opacity duration-500" : ""}>
            <button
              onClick={() => setShowWorkDefs(!showWorkDefs)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5 w-full"
            >
              <Zap className="w-4 h-4" />
              <span>Work Tasks</span>
              {allWorkDone && (
                <span className="text-xs font-normal text-green-600 normal-case tracking-normal ml-1">
                  — all done!
                </span>
              )}
              <span className="ml-auto">
                {showWorkDefs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            {showWorkDefs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {workDefs.map((def) => {
                  const isDone = completedDefIds.has(def.id);
                  return (
                    <button
                      key={def.id}
                      onClick={() => handleStartTask(def)}
                      disabled={actionLoading}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDone
                          ? "bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300"
                          : "bg-white border-slate-200 hover:bg-blue-50 hover:border-blue-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isDone
                          ? "bg-green-100 group-hover:bg-green-200"
                          : "bg-blue-50 group-hover:bg-blue-100"
                      }`}>
                        {isDone
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Zap className="w-4 h-4 text-blue-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isDone ? "text-green-700 underline decoration-green-400 underline-offset-2" : "text-slate-700"
                        }`}>
                          {def.name}
                        </p>
                        {def.description && (
                          <p className="text-xs text-slate-400 truncate">{def.description}</p>
                        )}
                      </div>
                      {isDone
                        ? <CheckCircle className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
                        : <Play className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto flex-shrink-0 transition-colors" />
                      }
                    </button>
                  );
                })}

                {/* Custom work task */}
                <button
                  onClick={() => setCreateModal({ open: true, type: "custom-work" })}
                  disabled={actionLoading}
                  className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Custom work task...</p>
                </button>
              </div>
            )}
          </div>

          {/* Personal task definitions */}
          <div>
            <button
              onClick={() => setShowPersonalDefs(!showPersonalDefs)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2.5 w-full"
            >
              <Coffee className="w-4 h-4" />
              <span>Personal / Break</span>
              <span className="ml-auto">
                {showPersonalDefs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            {showPersonalDefs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {personalDefs.map((def) => (
                  <button
                    key={def.id}
                    onClick={() => handleStartTask(def)}
                    disabled={actionLoading}
                    className="flex items-center gap-3 p-3 bg-white hover:bg-orange-50 rounded-xl border border-slate-200 hover:border-orange-300 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 bg-orange-50 group-hover:bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                      <Coffee className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{def.name}</p>
                      {def.description && (
                        <p className="text-xs text-slate-400 truncate">{def.description}</p>
                      )}
                    </div>
                    <Play className="w-4 h-4 text-slate-300 group-hover:text-orange-500 ml-auto flex-shrink-0 transition-colors" />
                  </button>
                ))}

                {/* Custom personal task */}
                <button
                  onClick={() => setCreateModal({ open: true, type: "personal" })}
                  disabled={actionLoading}
                  className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Custom personal task...</p>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right column: Productivity stats */}
        {data?.activeShift && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Shift Summary
            </h2>
            <ProductivityStats
              tasks={allTasks}
              shiftStartTime={data.activeShift.startTime}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={createModal.open}
        onClose={() => setCreateModal({ open: false, type: createModal.type })}
        onSubmit={handleCreateTask}
        taskDefinitions={data?.taskDefinitions || []}
        type={createModal.type}
        loading={actionLoading}
      />

      <ConfirmModal
        isOpen={conflictModal.open}
        onClose={() => setConflictModal({ open: false, pendingAction: null, message: "" })}
        onConfirm={async () => {
          if (conflictModal.pendingAction) {
            setConflictModal({ open: false, pendingAction: null, message: "" });
            await conflictModal.pendingAction();
          }
        }}
        title="Another task is running"
        message={conflictModal.message}
        confirmText="Yes, pause and switch"
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmModal
        isOpen={endShiftModal}
        onClose={() => setEndShiftModal(false)}
        onConfirm={() => handleEndShift(true)}
        title="End shift with running task?"
        message={`"${data?.activeTask?.name}" is still running. Do you want to stop it and end your shift?`}
        confirmText="Stop task & end shift"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function LastShiftReviewPanel({ review }: { review: LastShiftReview }) {
  const [open, setOpen] = useState(false);
  const pendingCount = review.tasks.filter((t) => !t.review).length;
  const approvedCount = review.tasks.filter((t) => t.review?.status === "APPROVED").length;
  const rejectedCount = review.tasks.filter((t) => t.review?.status === "REJECTED").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header — clickable toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-sm">Last Shift Review</h2>
              <p className="text-slate-400 text-[11px] truncate">
                {new Date(review.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {" · "}
                {new Date(review.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {new Date(review.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-white font-mono font-bold text-base">{formatDuration(review.durationSeconds)}</p>
            {open
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </div>
      </button>

      {/* Collapsible body */}
      {open && <>

      {/* Stats bar */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 leading-tight">Work</p>
            <p className="text-xs font-bold font-mono text-green-700 truncate">{formatDuration(review.workSeconds)}</p>
          </div>
        </div>
        <div className="px-3 py-2.5 flex items-center gap-2">
          <Coffee className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 leading-tight">Breaks</p>
            <p className="text-xs font-bold font-mono text-orange-700 truncate">{formatDuration(review.personalSeconds)}</p>
          </div>
        </div>
        <div className="px-3 py-2.5 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 leading-tight">Reviews</p>
            <p className="text-xs font-semibold leading-tight">
              {pendingCount > 0 && <span className="text-yellow-600">{pendingCount}⏳</span>}
              {approvedCount > 0 && <span className="text-green-600 ml-0.5">{approvedCount}✓</span>}
              {rejectedCount > 0 && <span className="text-red-600 ml-0.5">{rejectedCount}✗</span>}
              {pendingCount === 0 && approvedCount === 0 && rejectedCount === 0 && (
                <span className="text-slate-400">—</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="divide-y divide-slate-50">
        {review.tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">No tasks recorded this shift.</div>
        ) : (
          review.tasks.map((task) => (
            <div key={task.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    task.category === "WORK" ? "bg-blue-50" : "bg-orange-50"
                  }`}>
                    {task.category === "WORK"
                      ? <Zap className="w-3.5 h-3.5 text-blue-500" />
                      : <Coffee className="w-3.5 h-3.5 text-orange-500" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm leading-tight">{task.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                        {task.category === "WORK" ? "Work" : "Break"}
                      </Badge>
                      {task.review ? (
                        <Badge variant={task.review.status === "APPROVED" ? "approved" : "rejected"}>
                          {task.review.status === "APPROVED" ? "Approved" : "Rejected"}
                        </Badge>
                      ) : (
                        <Badge variant="pending">Pending</Badge>
                      )}
                    </div>
                    {task.review?.comment && (
                      <div className="mt-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5">
                        <p className="text-[10px] text-slate-500 font-medium">From {task.review.adminName}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{task.review.comment}</p>
                      </div>
                    )}
                    {task.startedAt && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(task.startedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {task.completedAt && (
                          <> → {new Date(task.completedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono font-semibold text-slate-700 text-sm">{formatDuration(task.totalActiveTime)}</p>
                  {task.review && (
                    task.review.status === "APPROVED"
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-600 ml-auto mt-1" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto mt-1" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400 text-center">
          {pendingCount > 0
            ? `${pendingCount} task${pendingCount !== 1 ? "s" : ""} still waiting for manager review`
            : "All tasks have been reviewed — start your next shift when ready!"}
        </p>
      </div>
      </>}
    </div>
  );
}
