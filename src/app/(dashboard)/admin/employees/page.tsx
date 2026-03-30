"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Users,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Key,
  Clock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDateTime, formatDuration } from "@/lib/utils";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { shifts: number; taskEntries: number };
}

interface StaffDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  shifts: Array<{
    id: string;
    startTime: string;
    endTime?: string | null;
    taskEntries: Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      totalActiveTime: number;
      review?: { status: string } | null;
    }>;
  }>;
}

interface TaskDef {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

type ModalType =
  | { type: "create" }
  | { type: "edit"; staff: StaffMember }
  | { type: "password"; staff: StaffMember }
  | { type: "delete"; staff: StaffMember }
  | { type: "detail"; staff: StaffMember }
  | { type: "assign"; staff: StaffMember }
  | null;

export default function EmployeesPage() {
  const { success, error: showError } = useToast();
  const [modal, setModal] = useState<ModalType>(null);
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"EMPLOYEE" | "CO_ADMIN">("EMPLOYEE");

  // Form states
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" });
  const [editForm, setEditForm] = useState({ name: "", email: "", isActive: true });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirm: "" });
  const [assignedTaskIds, setAssignedTaskIds] = useState<string[]>([]);

  const { data: staffData, mutate: mutateStaff } = useSWR<{ employees: StaffMember[] }>("/api/employees", fetcher);
  const { data: taskData } = useSWR<{ tasks: TaskDef[] }>("/api/task-definitions", fetcher);
  const staff = staffData?.employees || [];
  const taskDefs = taskData?.tasks || [];

  const loadDetail = async (member: StaffMember) => {
    setDetailLoading(true);
    setDetail(null);
    setModal({ type: "detail", staff: member });
    try {
      const res = await fetch(`/api/employees/${member.id}`, { cache: "no-store" });
      const json = await res.json();
      setDetail(json.employee);
    } catch {
      showError("Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAssignments = async (member: StaffMember) => {
    setModal({ type: "assign", staff: member });
    try {
      const responses = await Promise.all(
        taskDefs.map((t) => fetch(`/api/task-definitions/${t.id}/assign`).then((r) => r.json()))
      );
      const assigned: string[] = [];
      taskDefs.forEach((t, i) => {
        if (responses[i].userIds?.includes(member.id)) assigned.push(t.id);
      });
      setAssignedTaskIds(assigned);
    } catch {
      showError("Failed to load assignments");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success(`${createForm.role === "CO_ADMIN" ? "Co-Admin" : "Employee"} created!`);
      setModal(null);
      setCreateForm({ name: "", email: "", password: "", role: "EMPLOYEE" });
      await mutateStaff();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "edit") return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${modal.staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success("Account updated!");
      setModal(null);
      await mutateStaff();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modal?.type !== "password") return;
    if (passwordForm.newPassword !== passwordForm.confirm) {
      showError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${modal.staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordForm.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success("Password updated!");
      setModal(null);
      setPasswordForm({ newPassword: "", confirm: "" });
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${modal.staff.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success("Account deleted");
      setModal(null);
      await mutateStaff();
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (modal?.type !== "assign") return;
    setSubmitting(true);
    try {
      await Promise.all(
        taskDefs.map(async (taskDef) => {
          const isAssigned = assignedTaskIds.includes(taskDef.id);
          const res = await fetch(`/api/task-definitions/${taskDef.id}/assign`);
          const data = await res.json();
          const currentUserIds: string[] = data.userIds || [];
          const newUserIds = isAssigned
            ? currentUserIds.includes(modal.staff.id) ? currentUserIds : [...currentUserIds, modal.staff.id]
            : currentUserIds.filter((id) => id !== modal.staff.id);
          await fetch(`/api/task-definitions/${taskDef.id}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: newUserIds }),
          });
        })
      );
      success("Task assignments saved!");
      setModal(null);
    } catch {
      showError("Failed to save assignments");
    } finally {
      setSubmitting(false);
    }
  };

  const employees = staff.filter((s) => s.role === "EMPLOYEE");
  const coAdmins = staff.filter((s) => s.role === "CO_ADMIN");
  const displayList = activeTab === "EMPLOYEE" ? employees : coAdmins;


  const StaffTable = () => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {displayList.length === 0 ? (
        <div className="p-12 text-center">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            No {activeTab === "CO_ADMIN" ? "co-admins" : "employees"} yet
          </p>
          <button
            onClick={() => { setCreateForm({ ...createForm, role: activeTab }); setModal({ type: "create" }); }}
            className="btn-primary mt-3 text-sm"
          >
            Add {activeTab === "CO_ADMIN" ? "Co-Admin" : "Employee"}
          </button>
        </div>
      ) : (
        <>
        {/* Desktop table */}
        <table className="hidden sm:table w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Shifts</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((member) => (
              <tr key={member.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      member.role === "CO_ADMIN" ? "bg-yellow-100" : "bg-blue-100"
                    }`}>
                      <span className={`font-semibold text-sm ${member.role === "CO_ADMIN" ? "text-yellow-700" : "text-blue-700"}`}>
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="text-sm font-medium text-slate-600">{member._count.shifts}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  <Badge variant={member.isActive ? "active" : "completed"}>
                    {member.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    {member.role === "EMPLOYEE" && (
                      <button onClick={() => loadDetail(member)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="View shifts">
                        <Clock className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => loadAssignments(member)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-purple-600 transition-colors" title="Assign tasks">
                      <ClipboardList className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditForm({ name: member.name, email: member.email, isActive: member.isActive }); setModal({ type: "edit", staff: member }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-green-600 transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setPasswordForm({ newPassword: "", confirm: "" }); setModal({ type: "password", staff: member }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-yellow-600 transition-colors" title="Change password">
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => setModal({ type: "delete", staff: member })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-50">
          {displayList.map((member) => (
            <div key={member.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                member.role === "CO_ADMIN" ? "bg-yellow-100" : "bg-blue-100"
              }`}>
                <span className={`font-semibold text-sm ${member.role === "CO_ADMIN" ? "text-yellow-700" : "text-blue-700"}`}>
                  {member.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800 text-sm truncate">{member.name}</p>
                  <Badge variant={member.isActive ? "active" : "completed"}>
                    {member.isActive ? "Active" : "Off"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 truncate">{member.email}</p>
                <p className="text-xs text-slate-400">{member._count.shifts} shifts</p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {member.role === "EMPLOYEE" && (
                  <button onClick={() => loadDetail(member)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="View shifts">
                    <Clock className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => loadAssignments(member)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-purple-600" title="Assign tasks">
                  <ClipboardList className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditForm({ name: member.name, email: member.email, isActive: member.isActive }); setModal({ type: "edit", staff: member }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-green-600" title="Edit">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setPasswordForm({ newPassword: "", confirm: "" }); setModal({ type: "password", staff: member }); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-yellow-600" title="Password">
                  <Key className="w-4 h-4" />
                </button>
                <button onClick={() => setModal({ type: "delete", staff: member })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
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
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Team Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage employees and co-admins</p>
        </div>
        <button
          onClick={() => { setCreateForm({ name: "", email: "", password: "", role: activeTab }); setModal({ type: "create" }); }}
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden xs:inline">Add </span>{activeTab === "CO_ADMIN" ? "Co-Admin" : "Employee"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("EMPLOYEE")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "EMPLOYEE" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Employees
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{employees.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("CO_ADMIN")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "CO_ADMIN" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Star className="w-4 h-4" />
          Co-Admins
          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{coAdmins.length}</span>
        </button>
      </div>

      <StaffTable />

      {/* CREATE MODAL */}
      <Modal isOpen={modal?.type === "create"} onClose={() => setModal(null)} title="Create New Account">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Role selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Account type</label>
            <div className="flex gap-3">
              {[
                { value: "EMPLOYEE", label: "Employee", desc: "Track tasks & shifts", icon: <Users className="w-4 h-4" /> },
                { value: "CO_ADMIN", label: "Co-Admin", desc: "Review tasks only", icon: <Star className="w-4 h-4" /> },
              ].map((opt) => (
                <label key={opt.value} className="flex-1">
                  <input type="radio" name="role" value={opt.value} checked={createForm.role === opt.value}
                    onChange={() => setCreateForm({ ...createForm, role: opt.value })} className="sr-only" />
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
                    createForm.role === opt.value ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <span className="text-slate-500">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{opt.label}</p>
                      <p className="text-xs text-slate-400">{opt.desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. John Smith" className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="employee@example.com" className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Min. 6 characters" className="input-field pr-10" required minLength={6} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            {createForm.role === "CO_ADMIN"
              ? "Co-admin can only review tasks. They cannot manage employees or task templates."
              : "Employee credentials are set by admin. Employees cannot change their own login details."}
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={modal?.type === "edit"} onClose={() => setModal(null)}
        title={`Edit: ${modal?.type === "edit" ? modal.staff.name : ""}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account status</label>
            <div className="flex gap-3">
              {[{ value: true, label: "Active" }, { value: false, label: "Inactive" }].map((opt) => (
                <label key={String(opt.value)} className="flex-1">
                  <input type="radio" name="isActive" checked={editForm.isActive === opt.value}
                    onChange={() => setEditForm({ ...editForm, isActive: opt.value })} className="sr-only" />
                  <div className={`py-2.5 rounded-xl border-2 cursor-pointer text-center text-sm font-medium transition-colors ${
                    editForm.isActive === opt.value
                      ? opt.value ? "border-green-400 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-500"
                  }`}>{opt.label}</div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal isOpen={modal?.type === "password"} onClose={() => setModal(null)}
        title={`Set Password: ${modal?.type === "password" ? modal.staff.name : ""}`}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 text-sm text-yellow-700">
            You are setting the password for <strong>{modal?.type === "password" ? modal.staff.name : ""}</strong>.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showNewPassword ? "text" : "password"} value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Min. 6 characters" className="input-field pr-10" required minLength={6} />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password <span className="text-red-500">*</span></label>
            <input type="password" value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="input-field" required />
          </div>
          {passwordForm.newPassword && passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm && (
            <p className="text-red-500 text-sm">Passwords do not match</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || (!!passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm)}>
              {submitting ? "Updating..." : "Set Password"}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmModal
        isOpen={modal?.type === "delete"}
        onClose={() => setModal(null)}
        onConfirm={handleDelete}
        title="Delete account permanently?"
        message={`This will permanently delete ${modal?.type === "delete" ? modal.staff.name : ""}'s account and ALL associated data. This cannot be undone.`}
        confirmText="Delete Permanently"
        variant="danger"
        loading={submitting}
      />

      {/* DETAIL MODAL */}
      <Modal isOpen={modal?.type === "detail"} onClose={() => setModal(null)}
        title={`Last 3 Shifts: ${modal?.type === "detail" ? modal.staff.name : ""}`} size="lg">
        {detailLoading ? (
          <div className="flex items-center justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : detail ? (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {detail.shifts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No shifts yet</p>
            ) : (
              detail.shifts.map((shift) => {
                const isExpanded = expandedShifts.has(shift.id);
                const workTime = shift.taskEntries.filter((t) => t.category === "WORK").reduce((s, t) => s + t.totalActiveTime, 0);
                const personalTime = shift.taskEntries.filter((t) => t.category === "PERSONAL").reduce((s, t) => s + t.totalActiveTime, 0);
                return (
                  <div key={shift.id} className="border border-slate-100 rounded-xl overflow-hidden">
                    <button onClick={() => { const n = new Set(expandedShifts); if (isExpanded) n.delete(shift.id); else n.add(shift.id); setExpandedShifts(n); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Badge variant={shift.endTime ? "completed" : "active"}>{shift.endTime ? "Ended" : "Active"}</Badge>
                        <span className="text-sm font-medium text-slate-700">{formatDateTime(shift.startTime)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="text-green-600">{formatDuration(workTime)} work</span>
                        <span className="text-orange-600">{formatDuration(personalTime)} personal</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {isExpanded && shift.taskEntries.length > 0 && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {shift.taskEntries.map((task) => (
                          <div key={task.id} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Badge variant={task.category === "WORK" ? "work" : "personal"}>{task.category === "WORK" ? "W" : "P"}</Badge>
                              <span className="text-sm text-slate-700">{task.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-500">{formatDuration(task.totalActiveTime)}</span>
                              <Badge variant={task.status === "COMPLETED" ? "completed" : task.status === "ACTIVE" ? "active" : "paused"}>
                                {task.status.toLowerCase()}
                              </Badge>
                              {task.review && <Badge variant={task.review.status === "APPROVED" ? "approved" : "rejected"}>{task.review.status.toLowerCase()}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {detail.shifts.length > 0 && (
              <a
                href={`/admin/shifts`}
                className="flex items-center justify-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors"
              >
                View full shift history in Shift Reports →
              </a>
            )}
          </div>
        ) : null}
      </Modal>

      {/* TASK ASSIGNMENT MODAL */}
      <Modal isOpen={modal?.type === "assign"} onClose={() => setModal(null)}
        title={`Task Access: ${modal?.type === "assign" ? modal.staff.name : ""}`} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Select which task templates this employee can see. If none are selected, they see all tasks.
          </p>
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {["WORK", "PERSONAL"].map((cat) => (
              <div key={cat}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${cat === "WORK" ? "text-blue-600" : "text-orange-600"}`}>
                  {cat === "WORK" ? "Work Tasks" : "Personal / Break"}
                </p>
                {taskDefs.filter((t) => t.category === cat && t.isActive).map((task) => (
                  <label key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={assignedTaskIds.includes(task.id)}
                      onChange={(e) => e.target.checked
                        ? setAssignedTaskIds([...assignedTaskIds, task.id])
                        : setAssignedTaskIds(assignedTaskIds.filter((id) => id !== task.id))}
                      className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-sm text-slate-700">{task.name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
            No selections = all tasks visible. Selections = only those tasks visible.
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setModal(null)} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button onClick={handleSaveAssignments} className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
