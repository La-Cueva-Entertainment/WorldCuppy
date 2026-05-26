"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 8000; // 8s between polls (≤ 8 calls/min)

export function LiveSync() {
  const router = useRouter();
  const [status, setStatus] = useState<"syncing" | "live" | "error">("syncing");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const nextAllowedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function sync() {
    const delay = Math.max(0, nextAllowedRef.current - Date.now());
    if (delay > 0) {
      timerRef.current = setTimeout(sync, delay);
      return;
    }

    try {
      const res = await fetch("/api/sync-matches", { method: "POST" });
      if (res.status === 429) {
        const data = (await res.json()) as { nextAllowedAt?: number };
        if (data.nextAllowedAt) nextAllowedRef.current = data.nextAllowedAt;
        timerRef.current = setTimeout(sync, Math.max(POLL_MS, data.nextAllowedAt ? data.nextAllowedAt - Date.now() : POLL_MS));
        return;
      }
      if (!res.ok) {
        setStatus("error");
        timerRef.current = setTimeout(sync, POLL_MS * 3);
        return;
      }
      const data = (await res.json()) as { updated: boolean; nextAllowedAt?: number };
      if (data.nextAllowedAt) nextAllowedRef.current = data.nextAllowedAt;
      if (data.updated) router.refresh();
      setStatus("live");
      setLastSync(new Date());
    } catch {
      setStatus("error");
    }
    timerRef.current = setTimeout(sync, POLL_MS);
  }

  useEffect(() => {
    timerRef.current = setTimeout(sync, 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "live" ? "bg-emerald-500 animate-pulse" :
          status === "error" ? "bg-red-500" :
          "bg-zinc-400 dark:bg-zinc-600"
        }`}
      />
      {status === "live"
        ? lastSync
          ? `Synced ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Live"
        : status === "error"
        ? "Sync error"
        : "Syncing…"}
    </div>
  );
}
