"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [googleState, setGoogleState] = useState<"loading" | "enabled" | "disabled">("enabled");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  useEffect(() => {
    let mounted = true;
    getProviders().then((providers) => {
      if (!mounted) return;
      setGoogleState(providers?.google ? "enabled" : "disabled");
    }).catch(() => {
      if (!mounted) return;
      setGoogleState("disabled");
    });
    return () => { mounted = false; };
  }, []);

  async function onSignInCredentials(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    const res = await signIn("credentials", { email, password, callbackUrl, redirect: true });
    if (res?.error) setStatus({ kind: "error", message: "Invalid login" });
  }

  return (
    <div className="login-layout">

      {/* ── Left promo (pitch panel) — hides on mobile ── */}
      <div className="pitch-panel hide-sm" style={{ padding: "clamp(32px,5vw,60px) clamp(24px,4vw,48px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: "420px" }}>
          <h1 style={{ color: "#fff", fontSize: "clamp(28px,3.5vw,44px)", marginBottom: "16px" }}>
            Pick nations.<br />Win the <span style={{ color: "var(--gold)" }}>pool.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,.75)", fontSize: "15px", lineHeight: 1.6, marginBottom: "32px" }}>
            Draft real national teams, earn money for every win, goal difference, and knockout upset.
          </p>
          {/* Mini feature list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              ["🌍", "All major international tournaments"],
              ["🐍", "Fair snake draft — everyone gets a shot"],
              ["📊", "Live earnings, tracked every match"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "rgba(255,255,255,.8)", fontWeight: 500 }}>
                <span style={{ fontSize: "18px" }}>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: form ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px,4vw,48px) clamp(20px,4vw,40px)", background: "var(--paper)" }}>
        <div style={{ width: "100%", maxWidth: "380px" }}>
          <h1 style={{ fontSize: "26px", marginBottom: "6px" }}>Sign in</h1>
          <p className="muted" style={{ fontSize: "14px", marginBottom: "28px" }}>
            Continue with Google, or use email and password.
          </p>

          <form onSubmit={onSignInCredentials} style={{ display: "grid", gap: "14px" }}>
            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                style={{
                  height: "46px", borderRadius: "11px", border: "1px solid var(--line)",
                  background: "var(--surface)", color: "var(--ink)", padding: "0 14px",
                  fontSize: "14px", outline: "none", width: "100%",
                  fontFamily: "var(--font-hanken), Hanken Grotesk, sans-serif",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--grass)"; e.target.style.boxShadow = "0 0 0 3px var(--grass-soft)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
              />
            </label>

            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                style={{
                  height: "46px", borderRadius: "11px", border: "1px solid var(--line)",
                  background: "var(--surface)", color: "var(--ink)", padding: "0 14px",
                  fontSize: "14px", outline: "none", width: "100%",
                  fontFamily: "var(--font-hanken), Hanken Grotesk, sans-serif",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--grass)"; e.target.style.boxShadow = "0 0 0 3px var(--grass-soft)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--line)"; e.target.style.boxShadow = "none"; }}
              />
            </label>

            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="btn btn-primary btn-block"
              style={{ marginTop: "4px" }}
            >
              {status.kind === "loading" ? "Signing in…" : "Sign in"}
            </button>

            {status.kind === "error" && (
              <p style={{ color: "var(--hot)", fontSize: "13px", margin: 0 }}>{status.message}</p>
            )}
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
            <div className="divider" style={{ flex: 1, margin: 0 }}></div>
            <span className="faint" style={{ fontSize: "12px", fontWeight: 600 }}>or</span>
            <div className="divider" style={{ flex: 1, margin: 0 }}></div>
          </div>

          <button
            type="button"
            disabled={googleState !== "enabled"}
            onClick={() => signIn("google", { callbackUrl })}
            className="btn btn-ghost btn-block"
            style={{ gap: "10px" }}
          >
            <GoogleG style={{ width: "20px", height: "20px", flexShrink: 0 }} />
            {googleState === "loading" ? "Checking Google…" : "Continue with Google"}
          </button>

          {googleState === "disabled" && (
            <p className="faint" style={{ fontSize: "12px", marginTop: "8px", textAlign: "center" }}>
              Google sign-in isn&apos;t configured on this server.
            </p>
          )}

          <p style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--grass-deep)", fontWeight: 700 }}>Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleG({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" style={style} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.61l6.9-6.9C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.03 6.24C12.5 13.5 17.77 9.5 24 9.5z"/>
      <path fill="#34A853" d="M46.5 24.5c0-1.62-.15-3.17-.43-4.67H24v9.02h12.67c-.55 2.96-2.2 5.47-4.7 7.16l7.2 5.59C43.23 37.43 46.5 31.52 46.5 24.5z"/>
      <path fill="#4A90E2" d="M10.59 28.46A14.5 14.5 0 0 1 9.5 24c0-1.55.27-3.04.76-4.46l-8.03-6.24A23.93 23.93 0 0 0 0 24c0 3.9.94 7.59 2.6 10.85l7.99-6.39z"/>
      <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.14 15.91-5.82l-7.2-5.59c-2.02 1.36-4.6 2.16-8.71 2.16-6.23 0-11.5-4-13.41-9.54l-7.99 6.39C6.53 42.55 14.64 48 24 48z"/>
    </svg>
  );
}
