"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Silently refreshes server data every `intervalMs` milliseconds using
 * Next.js router.refresh(). Drop into any server-rendered page that
 * shows live data (standings, draft board, match scores).
 */
export function LiveRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      lastRefreshRef.current = Date.now();
      router.refresh();
    }, intervalMs);

    // Also refresh on window focus — user returns to tab after a match
    function onFocus() {
      const stale = Date.now() - lastRefreshRef.current > 10_000;
      if (stale) {
        lastRefreshRef.current = Date.now();
        router.refresh();
      }
    }

    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, intervalMs]);

  return null;
}
