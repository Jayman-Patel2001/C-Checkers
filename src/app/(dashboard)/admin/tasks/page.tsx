"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  Coffee,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import type { TaskDefinition } from "@/types";

export default function TaskDefinitionsPage() {
  const { success, error: showError } = useToast();

  const [formModal, setFormModal] = useState<{
    open: boolean;
    task: TaskDefinition | null;
  }>({ open: false, task: null });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    task: TaskDefinition | null;
  }>({ open: false, task: null });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "WORK" as "WORK" | "PERSONAL",
    sortOrder: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR<{ tasks: TaskDefinition[] }>("/api/task-definitions", fetcher);
  const tasks = data?.tasks || [];

  const openCreateModal = () => {
    setFormData({ name: "", description: "", category: "WORK", sortOrder: 0 });
    setFormModal({ open: true, task: null });
  };

  const openEditModal = (task: TaskDefinition) => {
    setFormData({
      name: task.name,
      description: task.description || "",
      category: task.category,
      sortOrder: task.sortOrder,
    });
    setFormModal({ open: true, task });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = formModal.task ? "PATCH" : "POST";
      const url = formModal.task
        ? `/api/task-definitions/${formModal.task.id}`
        : "/api/task-definitions";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed");
      }

      success(formModal.task ? "Task updated!" : "Task created!");
      setFormModal({ open: false, task: null });
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (task: TaskDefinition) => {
    try {
      const res = await fetch(`/api/task-definitions/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !task.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      success(task.isActive ? "Task deactivated" : "Task activated");
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to toggle task");
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.task) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/task-definitions/${deleteModal.task.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      success("Task deactivated");
      setDeleteModal({ open: false, task: null });
      await mutate();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const workTasks = tasks.filter((t) => t.category === "WORK");
  const personalTasks = tasks.filter((t) => t.category === "PERSONAL");


  const TaskTable = ({
    items,
    category,
  }: {
    items: TaskDefinition[];
    category: "WORK" | "PERSONAL";
  }) => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        className={`px-5 py-3.5 border-b flex items-center gap-2 ${
          category === "WORK"
            ? "bg-blue-50 border-blue-100"
            : "bg-orange-50 border-orange-100"
        }`}
      >
        {category === "WORK" ? (
          <Zap className="w-4 h-4 text-blue-600" />
        ) : (
          <Coffee className="w-4 h-4 text-orange-600" />
        )}
        <span
          className={`font-semibold text-sm ${
            category === "WORK" ? "text-blue-700" : "text-orange-700"
          }`}
        >
          {category === "WORK" ? "Work Tasks" : "Personal / Break Tasks"}
        </span>
        <Badge variant={category === "WORK" ? "work" : "personal"} className="ml-1">
          {items.length}
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          No {category === "WORK" ? "work" : "personal"} tasks defined yet
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <table className="hidden sm:table w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <tr key={task.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!task.isActive ? "opacity-50" : ""}`}>
                <td className="px-5 py-3.5 font-medium text-slate-700">{task.name}</td>
                <td className="px-5 py-3.5 text-sm text-slate-500 max-w-64 truncate">{task.description || "—"}</td>
                <td className="px-5 py-3.5 text-center">
                  <Badge variant={task.isActive ? "active" : "completed"}>{task.isActive ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleToggleActive(task)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600" title={task.isActive ? "Deactivate" : "Activate"}>
                      {task.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEditModal(task)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteModal({ open: true, task })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {items.map((task) => (
            <div key={task.id} className={`px-4 py-3 flex items-center gap-3 ${!task.isActive ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 text-sm truncate">{task.name}</p>
                {task.description && <p className="text-xs text-slate-400 truncate mt-0.5">{task.description}</p>}
                <div className="mt-1">
                  <Badge variant={task.isActive ? "active" : "completed"}>{task.isActive ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => handleToggleActive(task)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title={task.isActive ? "Deactivate" : "Activate"}>
                  {task.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => openEditModal(task)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setDeleteModal({ open: true, task })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Task Templates</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage predefined tasks for employees</p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      <TaskTable items={workTasks} category="WORK" />
      <TaskTable items={personalTasks} category="PERSONAL" />

      {/* Create/Edit modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, task: null })}
        title={formModal.task ? "Edit Task Template" : "Add Task Template"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Task name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Fuel Pump Inspection"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this task..."
              className="input-field resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Category
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <input
                  type="radio"
                  name="category"
                  value="WORK"
                  checked={formData.category === "WORK"}
                  onChange={() => setFormData({ ...formData, category: "WORK" })}
                  className="sr-only"
                />
                <div
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    formData.category === "WORK"
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Zap className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Work</p>
                    <p className="text-xs text-slate-400">Productive time</p>
                  </div>
                </div>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  name="category"
                  value="PERSONAL"
                  checked={formData.category === "PERSONAL"}
                  onChange={() => setFormData({ ...formData, category: "PERSONAL" })}
                  className="sr-only"
                />
                <div
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    formData.category === "PERSONAL"
                      ? "border-orange-400 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Coffee className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="font-medium text-slate-700 text-sm">Personal</p>
                    <p className="text-xs text-slate-400">Break / downtime</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Sort order
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) =>
                setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
              }
              className="input-field"
              min={0}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setFormModal({ open: false, task: null })}
              className="btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting
                ? "Saving..."
                : formModal.task
                ? "Save Changes"
                : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, task: null })}
        onConfirm={handleDelete}
        title="Deactivate task template"
        message={`Are you sure you want to deactivate "${deleteModal.task?.name}"? It will no longer appear for employees but historical data will be kept.`}
        confirmText="Deactivate"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}
