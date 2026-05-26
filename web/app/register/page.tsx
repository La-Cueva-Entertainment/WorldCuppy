"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!resp.ok) {
      const data = (await resp.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: data?.error ?? "Registration failed" });
      return;
    }
    await signIn("credentials", { email, password, callbackUrl, redirect: true });
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Create account</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create an email/password account.</p>
          </div>
          <Link href="/login" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            Sign in
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
          <form onSubmit={onRegister} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
                className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500"
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500"
                required
              />
            </label>
            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Create account
            </button>
            {status.kind === "error" && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{status.message}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
