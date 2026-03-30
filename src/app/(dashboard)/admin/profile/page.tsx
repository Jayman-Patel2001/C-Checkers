"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { User, Key, Eye, EyeOff, Shield } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

export default function AdminProfilePage() {
  const { data: session, update } = useSession();
  const { success, error: showError } = useToast();

  const [nameForm, setNameForm] = useState({ name: session?.user?.name || "" });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirm: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameForm.name.trim()) return;
    setNameSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameForm.name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await update({ name: nameForm.name.trim() });
      success("Display name updated!");
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to update name");
    } finally {
      setNameSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      showError("New passwords do not match");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      success("Password changed successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 mt-1">Manage your admin account settings</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
            <span className="text-purple-700 font-bold text-xl">
              {session?.user?.name?.charAt(0) || "A"}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{session?.user?.name}</h2>
            <p className="text-slate-500 text-sm">{session?.user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">Station Manager / Admin</span>
            </div>
          </div>
        </div>

        {/* Update name */}
        <form onSubmit={handleNameSave} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            Display Name
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={nameForm.name}
              onChange={(e) => setNameForm({ name: e.target.value })}
              className="input-field flex-1"
              required
            />
            <button
              type="submit"
              className="btn-primary whitespace-nowrap"
              disabled={nameSaving || !nameForm.name.trim()}
            >
              {nameSaving ? "Saving..." : "Update"}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-slate-400" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Current password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input-field pr-10"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              New password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Minimum 6 characters"
                className="input-field pr-10"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirm new password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="input-field"
              required
            />
            {passwordForm.newPassword && passwordForm.confirm &&
              passwordForm.newPassword !== passwordForm.confirm && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={
              passwordSaving ||
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              (!!passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm)
            }
          >
            {passwordSaving ? "Changing password..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
