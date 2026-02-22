"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function formatSeconds(s: number) {
  const sec = clampInt(s);
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function DraftPickTimer({
  enabled,
  leagueId,
  pickSeconds,
  pickStartedAtIso,
  onTheClockLabel,
  onTheClockIsBot,
  tickDraftAction,
}: {
  enabled: boolean;
  leagueId: string;
  pickSeconds: number;
  pickStartedAtIso: string;
  onTheClockLabel: string | null;
  onTheClockIsBot: boolean;
  tickDraftAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastFiredPickRef = useRef<string | null>(null);

  const deadlineMs = useMemo(() => {
    const start = Date.parse(pickStartedAtIso);
    if (!Number.isFinite(start)) return null;
    return start + clampInt(pickSeconds) * 1000;
  }, [pickStartedAtIso, pickSeconds]);

  const remainingSeconds = useMemo(() => {
    if (!enabled || deadlineMs == null) return null;
    const ms = deadlineMs - nowMs;
    return Math.ceil(ms / 1000);
  }, [deadlineMs, enabled, nowMs]);

  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (remainingSeconds == null) return;
    if (isPending) return;

    const shouldFire = onTheClockIsBot || remainingSeconds <= 0;
    if (!shouldFire) return;

    if (lastFiredPickRef.current === pickStartedAtIso) return;
    lastFiredPickRef.current = pickStartedAtIso;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("leagueId", leagueId);
      await tickDraftAction(fd);
      router.refresh();
    });
  }, [enabled, isPending, leagueId, onTheClockIsBot, pickStartedAtIso, remainingSeconds, router, tickDraftAction]);

  if (!enabled || remainingSeconds == null) return null;

  const isOverdue = remainingSeconds <= 0;
  const timeText = isOverdue ? "00:00" : formatSeconds(remainingSeconds);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-400">Pick timer:</span>
      <span
        className={
          "font-semibold " +
          (isOverdue
            ? "text-red-200"
            : remainingSeconds <= 10
              ? "text-amber-200"
              : "text-emerald-100")
        }
        aria-label="Time remaining"
        title="When the timer hits zero, the top available team is auto-picked."
      >
        {timeText}
      </span>
      {onTheClockLabel ? (
        <span className="text-zinc-500">(On the clock: {onTheClockLabel})</span>
      ) : null}
      {isPending ? <span className="text-zinc-500">Auto-picking…</span> : null}
    </div>
  );
}
