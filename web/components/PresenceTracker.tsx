"use client";

import { useEffect } from "react";

const INTERVAL_MS = 30_000; // ping every 30s
const ONLINE_THRESHOLD_MS = 2 * 60_000; // considered online for 2 min after last ping

export { ONLINE_THRESHOLD_MS };

/**
 * Invisible component that sends a heartbeat to /api/presence while the page
 * is visible. Stops when the tab/PWA is hidden or closed, so users naturally
 * fall off the "Active now" list within ~2 minutes.
 */
export function PresenceTracker() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function ping() {
      try {
        await fetch("/api/presence", { method: "POST" });
      } catch {
        // ignore network errors silently
      }
    }

    function start() {
      if (timer) return;
      ping(); // immediate ping on focus/visibility
      timer = setInterval(ping, INTERVAL_MS);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    // Start immediately if visible
    if (document.visibilityState === "visible") start();

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, []);

  return null;
}
