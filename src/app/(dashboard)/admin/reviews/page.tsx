"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Star,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Filter,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDuration, formatDateTime, formatTime } from "@/lib/utils";
import type { TaskEntryWithUser } from "@/types";

export default function ReviewsPage() {
  const { success, error: showError } = useToast();
  const [filterUser, setFilterUser] = useState<string>("");
  const [showReviewed, setShowReviewed] = useState(false);

  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    task: TaskEntryWithUser | null;
    status: "APPROVED" | "REJECTED";
  }>({ open: false, task: null, status: "APPROVED" });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR<{ tasks: TaskEntryWithUser[] }>(
    `/api/reviews?includeReviewed=${showReviewed}`,
    fetcher
  );
  const tasks = data?.tasks || [];

  const uniqueEmployees = Array.from(
    new Map(tasks.map((t) => [t.user.id, t.user])).values()
  );

  const openReviewModal = (task: TaskEntryWithUser, status: "APPROVED" | "REJECTED") => {
    setReviewModal({ open: true, task, status });
    setComment(task.review?.comment || "");
  };

  const handleSubmitReview = async () => {
    if (!reviewModal.task) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskEntryId: reviewModal.task.id,
          status: reviewModal.status,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed");
      }
      success(reviewModal.status === "APPROVED" ? "Task approved!" : "Task rejected");
      setReviewModal({ open: false, task: null, status: "APPROVED" });
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = filterUser
    ? tasks.filter((t) => t.user.id === filterUser)
    : tasks;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Task Reviews</h1>
          <p className="text-slate-500 text-sm mt-0.5">Review and approve completed employee tasks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {uniqueEmployees.length > 1 && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="input-field py-1.5 text-sm w-40"
              >
                <option value="">All employees</option>
                {uniqueEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showReviewed}
              onChange={(e) => setShowReviewed(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-600">Show reviewed</span>
          </label>

          <button onClick={() => mutate()} className="btn-secondary py-1.5 flex items-center gap-1.5 text-sm">
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-yellow-600">
            {tasks.filter((t) => !t.review).length}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">Pending Review</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {tasks.filter((t) => t.review?.status === "APPROVED").length}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">Approved</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-red-600">
            {tasks.filter((t) => t.review?.status === "REJECTED").length}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">Rejected</p>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Star className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">All caught up!</h3>
          <p className="text-slate-500 text-sm">No tasks pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className={`bg-white rounded-xl border p-5 ${task.review ? "border-slate-100 opacity-80" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <span className="text-slate-600 font-medium text-xs">{task.user.name.charAt(0)}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{task.user.name}</span>
                    </div>
                    <span className="text-slate-400">·</span>
                    <h3 className="font-medium text-slate-700">{task.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={task.category === "WORK" ? "work" : "personal"}>
                        {task.category === "WORK" ? "Work" : "Personal"}
                      </Badge>
                      {task.isCustom && <Badge variant="default">Custom</Badge>}
                      {task.review && (
                        <Badge variant={task.review.status === "APPROVED" ? "approved" : "rejected"}>
                          {task.review.status === "APPROVED" ? "Approved" : "Rejected"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-slate-500 text-sm mt-1.5 ml-10">{task.description}</p>
                  )}

                  <div className="mt-2 ml-10 flex items-center gap-4 flex-wrap text-xs text-slate-500">
                    {task.startedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(task.startedAt)}
                      </span>
                    )}
                    {task.completedAt && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {formatDateTime(task.completedAt)}
                      </span>
                    )}
                    {task.shift && (
                      <span>Shift: {formatDateTime(task.shift.startTime)}</span>
                    )}
                  </div>

                  {task.review?.comment && (
                    <div className="mt-2 ml-10 bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 font-medium mb-0.5">
                        Review by {task.review.admin?.name}
                      </p>
                      <p className="text-xs text-slate-600">{task.review.comment}</p>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold font-mono text-slate-700">
                    {formatDuration(task.totalActiveTime)}
                  </div>
                  <p className="text-xs text-slate-400">active time</p>
                </div>
              </div>

              {!task.review && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                  <button
                    onClick={() => openReviewModal(task, "APPROVED")}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => openReviewModal(task, "REJECTED")}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => openReviewModal(task, "APPROVED")}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors ml-auto"
                  >
                    <MessageSquare className="w-4 h-4" />
                    With comment
                  </button>
                </div>
              )}

              {task.review && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                  <button
                    onClick={() => openReviewModal(task, task.review!.status as "APPROVED" | "REJECTED")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-colors"
                  >
                    <Filter className="w-3 h-3" />
                    Update review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, task: null, status: "APPROVED" })}
        title={reviewModal.task?.review ? "Update Review" : reviewModal.status === "APPROVED" ? "Approve Task" : "Reject Task"}
        size="sm"
      >
        <div className="space-y-4">
          {reviewModal.task && (
            <div className={`p-3 rounded-lg ${reviewModal.status === "APPROVED" ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
              <p className="font-medium text-slate-700">{reviewModal.task.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">by {reviewModal.task.user.name}</p>
              <p className="text-sm font-mono text-slate-600 mt-1">
                {formatDuration(reviewModal.task.totalActiveTime)} active time
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setReviewModal({ ...reviewModal, status: "APPROVED" })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${reviewModal.status === "APPROVED" ? "border-green-400 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"}`}
            >
              Approve
            </button>
            <button
              onClick={() => setReviewModal({ ...reviewModal, status: "REJECTED" })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${reviewModal.status === "REJECTED" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500"}`}
            >
              Reject
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Comment <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for the employee..."
              className="input-field min-h-20 resize-none"
              rows={3}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setReviewModal({ open: false, task: null, status: "APPROVED" })} className="btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button
              onClick={handleSubmitReview}
              disabled={submitting}
              className={reviewModal.status === "APPROVED" ? "btn-success" : "btn-danger"}
            >
              {submitting ? "Submitting..." : reviewModal.status === "APPROVED" ? "Approve Task" : "Reject Task"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
