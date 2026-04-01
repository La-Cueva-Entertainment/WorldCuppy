"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [googleState, setGoogleState] = useState<"loading" | "enabled" | "disabled">(
    "loading"
  );

  useEffect(() => {
    let mounted = true;
    getProviders()
      .then((providers) => {
        if (!mounted) return;
        setGoogleState(providers?.google ? "enabled" : "disabled");
      })
      .catch(() => {
        if (!mounted) return;
        setGoogleState("disabled");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function onSignInCredentials(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });

    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
      redirect: true,
    });

    if (res?.error) setStatus({ kind: "error", message: "Invalid login" });
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Continue with Google, or use email/password.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <form onSubmit={onSignInCredentials} className="grid gap-3">
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
                autoComplete="current-password"
                className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </label>

            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              Sign in with email
            </button>

            {status.kind === "error" ? (
              <p className="mt-2 text-sm text-red-600">{status.message}</p>
            ) : null}
          </form>

          <div className="my-5 border-t border-zinc-200" />

          <button
            type="button"
            disabled={googleState !== "enabled"}
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleG className="h-5 w-5" />
            {googleState === "loading" ? "Checking Google…" : "Sign in with Google"}
          </button>

          {googleState === "disabled" ? (
            <p className="mt-2 text-xs text-zinc-500">
              Google sign-in isn’t configured yet. Set GOOGLE_CLIENT_ID and
              GOOGLE_CLIENT_SECRET in .env and restart the dev server.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">New here?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Create an account with email/password.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Create account
          </Link>
        </div>
      </main>
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  // Simple multi-color Google "G" mark (inline SVG)
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.61l6.9-6.9C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.03 6.24C12.5 13.5 17.77 9.5 24 9.5z"
      />
      <path
        fill="#34A853"
        d="M46.5 24.5c0-1.62-.15-3.17-.43-4.67H24v9.02h12.67c-.55 2.96-2.2 5.47-4.7 7.16l7.2 5.59C43.23 37.43 46.5 31.52 46.5 24.5z"
      />
      <path
        fill="#4A90E2"
        d="M10.59 28.46A14.5 14.5 0 0 1 9.5 24c0-1.55.27-3.04.76-4.46l-8.03-6.24A23.93 23.93 0 0 0 0 24c0 3.9.94 7.59 2.6 10.85l7.99-6.39z"
      />
      <path
        fill="#FBBC05"
        d="M24 48c6.48 0 11.93-2.14 15.91-5.82l-7.2-5.59c-2.02 1.36-4.6 2.16-8.71 2.16-6.23 0-11.5-4-13.41-9.54l-7.99 6.39C6.53 42.55 14.64 48 24 48z"
      />
    </svg>
  );
}
