"use client";

import React, { useState } from "react";

type FormState = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type StatusState = {
  type: "idle" | "loading" | "error" | "success";
  message?: string;
};

const initialForm: FormState = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function PasswordManagePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const validate = (): string | null => {
    if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
      return "All fields are required.";
    }
    if (form.newPassword.length < 6) {
      return "New password must be at least 6 characters.";
    }
    if (form.newPassword !== form.confirmPassword) {
      return "New password and confirm password do not match.";
    }
    if (form.oldPassword === form.newPassword) {
      return "New password must be different from old password.";
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setStatus({ type: "error", message: err });
      return;
    }

    setStatus({ type: "loading", message: "Updating password..." });

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        }),
      });

      const data = (await res.json()) as { error?: string; success?: boolean };

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update password.");
      }

      setStatus({ type: "success", message: "Password updated successfully." });
      setForm(initialForm);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update password.";
      setStatus({ type: "error", message: msg });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-neutral)] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[var(--color-sidebar)]">
            Password Management
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Update your admin password to keep your account secure.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-white)] shadow-sm">
          <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-6 py-5">
            <h2 className="text-base font-semibold text-[var(--color-sidebar)]">
              Change Password
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Use a strong password and avoid reusing old passwords.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6 px-6 py-6">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[var(--color-sidebar)]">
                Old Password
              </label>
              <input
                name="oldPassword"
                type="password"
                value={form.oldPassword}
                onChange={onChange}
                autoComplete="current-password"
                className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-4 py-3 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                placeholder="Enter your current password"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--color-sidebar)]">
                  New Password
                </label>
                <input
                  name="newPassword"
                  type="password"
                  value={form.newPassword}
                  onChange={onChange}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-4 py-3 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[var(--color-sidebar)]">
                  Confirm New Password
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={onChange}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-4 py-3 text-sm text-[var(--color-sidebar)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/70"
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-neutral)] px-4 py-3 text-xs text-[var(--text-secondary)]">
              Password tips: use a mix of letters and numbers, avoid common words,
              and don’t reuse old passwords.
            </div>

            {status.type === "error" && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {status.message}
              </div>
            )}

            {status.type === "success" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                {status.message}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--text-secondary)]">
                You will stay logged in after updating your password.
              </p>
              <button
                type="submit"
                disabled={status.type === "loading"}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status.type === "loading"
                  ? "Updating..."
                  : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
