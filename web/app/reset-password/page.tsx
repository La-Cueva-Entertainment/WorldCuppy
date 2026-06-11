"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "done" } | { kind: "error"; message: string };

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!token) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-medium text-rose-800">Invalid reset link</p>
        <p className="mt-1 text-sm text-rose-700">This link is missing a token. Please request a new one.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-rose-700 hover:underline">
          Request reset link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setStatus({ kind: "error", message: "Passwords do not match" });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/password-reset?action=confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setStatus({ kind: "done" });
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }

  if (status.kind === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm font-medium text-emerald-800">Password updated!</p>
        <p className="mt-1 text-sm text-emerald-700">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">New password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Confirm password</span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>

        {status.kind === "error" && (
          <p className="text-sm text-red-600">{status.message}</p>
        )}

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="mt-1 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {status.kind === "loading" ? "Saving…" : "Set new password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Set new password</h1>
          <p className="mt-1 text-sm text-zinc-500">Choose a new password for your account.</p>
        </div>

        <Suspense fallback={<div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm animate-pulse h-48" />}>
          <ResetPasswordForm />
        </Suspense>

        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-emerald-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
