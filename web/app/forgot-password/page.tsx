"use client";

import Link from "next/link";
import { useState } from "react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "done" } | { kind: "error"; message: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/password-reset?action=request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Forgot password</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>
        </div>

        {status.kind === "done" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-sm font-medium text-emerald-800">Check your inbox</p>
            <p className="mt-1 text-sm text-emerald-700">
              If <strong>{email}</strong> is registered, you&apos;ll receive a reset link shortly. It expires in 1 hour.
            </p>
            <Link href="/login" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <form onSubmit={onSubmit} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-zinc-700">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
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
                {status.kind === "loading" ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-sm text-zinc-500">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-emerald-600 hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
