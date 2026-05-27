"use client";

import { useEffect, useState } from "react";

type Mode = "prompt" | "manual-ios" | "manual-chrome" | "hidden";

// Shared singleton so both instances (home page + hamburger) stay in sync
let globalMode: Mode | null = null;
let globalPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
function notify() { listeners.forEach((fn) => fn()); }

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallButton({ variant = "default" }: { variant?: "default" | "menu" }) {
  const [mode, setMode] = useState<Mode | null>(globalMode);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const sync = () => setMode(globalMode);
    listeners.add(sync);

    if (globalMode !== null) return () => { listeners.delete(sync); };

    // Already installed as PWA
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      globalMode = "hidden";
      setMode("hidden");
      notify();
      return () => { listeners.delete(sync); };
    }

    // iOS (Safari or Chrome on iOS) — beforeinstallprompt never fires, show steps immediately
    if (detectIOS()) {
      globalMode = "manual-ios";
      setMode("manual-ios");
      notify();
      return () => { listeners.delete(sync); };
    }

    // Chrome / Android / Desktop — wait for native install prompt
    let resolved = false;

    const handler = (e: Event) => {
      e.preventDefault();
      resolved = true;
      globalPrompt = e as BeforeInstallPromptEvent;
      globalMode = "prompt";
      setMode("prompt");
      notify();
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Give Chrome up to 5 s to fire beforeinstallprompt (needs SW + HTTPS).
    // Falls back to manual Chrome instructions if it never arrives.
    const timer = window.setTimeout(() => {
      if (!resolved) {
        globalMode = "manual-chrome";
        setMode("manual-chrome");
        notify();
      }
    }, 5000);

    return () => {
      listeners.delete(sync);
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(timer);
    };
  }, []);

  if (!mode || mode === "hidden") return null;

  const handleInstall = async () => {
    if (mode === "prompt" && globalPrompt) {
      await globalPrompt.prompt();
      const { outcome } = await globalPrompt.userChoice;
      if (outcome === "accepted") {
        globalMode = "hidden";
        globalPrompt = null;
        setMode("hidden");
        notify();
      }
      return;
    }
    setShowModal(true);
  };

  const label = mode === "prompt" ? "Install App" : "Add to Home Screen";

  if (variant === "menu") {
    return (
      <>
        <button
          type="button"
          onClick={handleInstall}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <DownloadIcon className="h-4 w-4 shrink-0" />
          {label}
        </button>
        {showModal && <InstallModal mode={mode} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/20"
      >
        <DownloadIcon className="h-4 w-4 shrink-0" />
        {label}
      </button>
      {showModal && <InstallModal mode={mode} onClose={() => setShowModal(false)} />}
    </>
  );
}

function InstallModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const steps = mode === "manual-ios"
    ? [
        <>Tap the <strong className="text-white">Share</strong> button{" "}
          <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">⬆</span>
          {" "}at the bottom of Safari</>,
        <>Scroll down and tap <strong className="text-white">Add to Home Screen</strong></>,
        <>Tap <strong className="text-white">Add</strong> to confirm</>,
      ]
    : [
        <>Tap the <strong className="text-white">menu</strong> icon{" "}
          <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">⋮</span>
          {" "}in the top-right of Chrome</>,
        <>Tap <strong className="text-white">Add to Home Screen</strong> or <strong className="text-white">Install app</strong></>,
        <>Tap <strong className="text-white">Install</strong> to confirm</>,
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20">
            <DownloadIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-white">Add to Home Screen</div>
            <div className="text-xs text-zinc-400">Install World Cuppy as an app</div>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-zinc-300">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-bold text-emerald-400">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-white/10 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v9m0 0-3-3m3 3 3-3" />
      <path d="M3 14v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
    </svg>
  );
}
