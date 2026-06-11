"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LIVE_INTERVAL_MS   = 6_000;             // 10 req/min — full budget during live match
const IDLE_INTERVAL_MS   = 15_000;            // cheap DB refresh when no match live
const MATCH_WINDOW_MS    = 115 * 60 * 1000;   // 90 min + 25 min extra-time buffer
const DAILY_STORAGE_KEY  = "wc_fixture_check";

interface Props {
  /** True only for admin — allows calling /api/sync-results */
  canSync: boolean;
  /** UTC epoch ms for every match scheduled today */
  matchTimes: number[];
}

export function LiveSync({ canSync, matchTimes }: Props) {
  const router = useRouter();
  const [isLive, setIsLive] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Keep a ref so the polling closure always sees the latest matchTimes
  // (router.refresh() updates props without remounting the component)
  const matchTimesRef = useRef(matchTimes);
  useEffect(() => { matchTimesRef.current = matchTimes; }, [matchTimes]);

  const syncInProgress = useRef(false);

  function inLiveWindow(): boolean {
    const now = Date.now();
    return matchTimesRef.current.some((t) => now >= t && now <= t + MATCH_WINDOW_MS);
  }

  async function callSync() {
    if (!canSync || syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);
    try {
      await fetch("/api/sync-results", { method: "POST" });
    } catch {
      // network error — next tick will retry
    } finally {
      syncInProgress.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    let active = true;

    // ── Daily fixture check ──────────────────────────────────────────────────
    // Sync once per day so match dates stay current and we know when to go live
    if (canSync) {
      const last = Number(localStorage.getItem(DAILY_STORAGE_KEY) ?? "0");
      if (Date.now() - last > 24 * 60 * 60 * 1000) {
        callSync().then(() => {
          localStorage.setItem(DAILY_STORAGE_KEY, String(Date.now()));
          router.refresh();
        });
      }
    }

    // ── Main polling loop ────────────────────────────────────────────────────
    let timerId: ReturnType<typeof setTimeout>;

    function tick() {
      if (!active) return;
      const live = inLiveWindow();
      setIsLive(live);
      router.refresh();
      if (live) callSync(); // fire-and-forget; syncInProgress guards overlap
      timerId = setTimeout(tick, live ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
    }

    // Small initial delay so the first tick doesn't race the page render
    timerId = setTimeout(tick, 2_000);

    // ── Refresh on tab focus ─────────────────────────────────────────────────
    function onFocus() {
      router.refresh();
      if (inLiveWindow()) callSync();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      clearTimeout(timerId);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, canSync]); // matchTimes changes are handled via ref above

  if (!isLive) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
      {syncing ? "Syncing live scores…" : "Live"}
    </div>
  );
}
