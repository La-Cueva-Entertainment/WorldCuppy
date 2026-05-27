"use client";

import { useEffect, useState } from "react";
import { InstallButton } from "@/components/InstallButton";

type Platform = "safari-ios" | "chrome-ios" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!ios) return "other";
  return /CriOS/.test(ua) ? "chrome-ios" : "safari-ios";
}

export function InlineInstallGuide() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    ) return;
    setPlatform(detectPlatform());
  }, []);

  if (platform === null) return null;

  if (platform === "safari-ios") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          📲 Add to Home Screen
        </p>
        <ol className="space-y-2">
          {[
            <>Tap the <strong className="text-white">Share</strong> button{" "}<span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">⬆</span>{" "}at the bottom</>,
            <>Tap <strong className="text-white">Add to Home Screen</strong></>,
            <>Tap <strong className="text-white">Add</strong></>,
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-300">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (platform === "chrome-ios") {
    const copyUrl = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback: select the text input
      }
    };

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          📲 Add to Home Screen
        </p>
        <ol className="space-y-3">
          <li className="flex items-start gap-2.5 text-sm text-zinc-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">1</span>
            <div className="flex-1">
              <span>Copy this page&apos;s URL</span>
              <button
                type="button"
                onClick={copyUrl}
                className="mt-1.5 flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
              >
                <span className="truncate text-zinc-300">{typeof window !== "undefined" ? window.location.host : ""}</span>
                <span className="ml-2 shrink-0 text-emerald-400">{copied ? "Copied ✓" : "Copy"}</span>
              </button>
            </div>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-zinc-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">2</span>
            <span>Open <strong className="text-white">Safari</strong> and paste the URL</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-zinc-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">3</span>
            <span>Tap the <strong className="text-white">Share</strong> button{" "}<span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">⬆</span>{" "}then <strong className="text-white">Add to Home Screen</strong></span>
          </li>
        </ol>
      </div>
    );
  }

  // Chrome / Android / Desktop
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">Save to your home screen for quick access</p>
      <InstallButton />
    </div>
  );
}
