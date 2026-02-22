"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });

    const resp = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!resp.ok) {
      const data = (await resp.json().catch(() => null)) as
        | { error?: string }
        | null;
      setStatus({
        kind: "error",
        message: data?.error ?? "Registration failed",
      });
      return;
    }

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: true,
    });
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Create account
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Create an email/password account.
            </p>
          </div>
          <Link href="/login" className="text-sm text-zinc-300 hover:text-white">
            Sign in
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <form onSubmit={onRegister} className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-200">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-200">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium text-zinc-200">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
                required
              />
            </label>

            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="mt-2 w-full rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-60"
            >
              Create account
            </button>

            {status.kind === "error" ? (
              <p className="mt-2 text-sm text-red-400">{status.message}</p>
            ) : null}
          </form>
        </div>
      </main>
    </div>
  );
}
