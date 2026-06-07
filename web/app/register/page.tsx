"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string };

const inputStyle: React.CSSProperties = {
  height: "46px", borderRadius: "11px", border: "1px solid var(--line)",
  background: "var(--surface)", color: "var(--ink)", padding: "0 14px",
  fontSize: "14px", outline: "none", width: "100%",
  fontFamily: "var(--font-hanken), Hanken Grotesk, sans-serif",
  transition: "border-color .15s, box-shadow .15s",
};

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

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

  function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--grass)";
    e.target.style.boxShadow = "0 0 0 3px var(--grass-soft)";
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--line)";
    e.target.style.boxShadow = "none";
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100vh - 60px)" }}>

      {/* ── Left promo ── */}
      <div className="pitch-panel hide-sm" style={{ padding: "clamp(32px,5vw,60px) clamp(24px,4vw,48px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: "420px" }}>
          <h1 style={{ color: "#fff", fontSize: "clamp(28px,3.5vw,44px)", marginBottom: "16px" }}>
            Join the pool.<br />Draft nations. <span style={{ color: "var(--gold)" }}>Win.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,.75)", fontSize: "15px", lineHeight: 1.6, marginBottom: "32px" }}>
            Create your account and get invited to a friend group&apos;s pool. Snake draft your teams and compete for real money.
          </p>
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
          <h1 style={{ fontSize: "26px", marginBottom: "6px" }}>Create account</h1>
          <p className="muted" style={{ fontSize: "14px", marginBottom: "28px" }}>
            Fill in your details to get started.
          </p>

          <form onSubmit={onRegister} style={{ display: "grid", gap: "14px" }}>
            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" placeholder="Your name" style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </label>
            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </label>
            <label style={{ display: "grid", gap: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" required style={inputStyle} onFocus={focusStyle} onBlur={blurStyle} />
            </label>
            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="btn btn-primary btn-block"
              style={{ marginTop: "4px" }}
            >
              {status.kind === "loading" ? "Creating…" : "Create account"}
            </button>
            {status.kind === "error" && (
              <p style={{ color: "var(--hot)", fontSize: "13px", margin: 0 }}>{status.message}</p>
            )}
          </form>

          <p style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--grass-deep)", fontWeight: 700 }}>Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
