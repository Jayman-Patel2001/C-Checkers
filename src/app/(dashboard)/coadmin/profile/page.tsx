"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Star, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

export default function CoAdminProfilePage() {
  const { data: session } = useSession();
  const { success, error: showError } = useToast();

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      showError("New passwords do not match");
      return;
    }
    setSaving(true);
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
      success("Password changed!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 mt-1">Co-Admin account settings</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center">
            <span className="text-yellow-700 font-bold text-xl">{session?.user?.name?.charAt(0)}</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{session?.user?.name}</h2>
            <p className="text-slate-500 text-sm">{session?.user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-xs text-yellow-600 font-medium">Co-Admin (Review Access)</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-4">
          Your account credentials are managed by the station admin. You can change your own password below.
        </p>

        <form onSubmit={handlePasswordSave} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Change Password</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current password</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              className="input-field"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
