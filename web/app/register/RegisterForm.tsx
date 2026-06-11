"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

export default function RegisterForm({ inviteToken }: { inviteToken: string | null }) {
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
      body: JSON.stringify({ name, email, password, inviteToken }),
    });

    if (!resp.ok) {
      const data = (await resp.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: data?.error ?? "Registration failed" });
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <form onSubmit={onRegister} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            autoComplete="name"
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            required
          />
        </label>

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {status.kind === "loading" ? "Creating account…" : "Create account"}
        </button>

        {status.kind === "error" && (
          <p className="text-sm text-red-600">{status.message}</p>
        )}
      </form>
    </div>
  );
}
