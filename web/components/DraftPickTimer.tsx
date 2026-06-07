"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatSeconds(s: number) {
  const sec = Math.max(0, Math.floor(s));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Pass `seconds={null}` for unlimited (no countdown / no auto-refresh). */
export function DraftPickTimer({ seconds, key: _key }: { seconds: number | null; key?: number }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(seconds ?? 0);

  useEffect(() => {
    if (seconds === null) return;
    setRemaining(seconds);
    const t = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          router.refresh();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [seconds, router]);

  if (seconds === null) {
    return (
      <div style={{ textAlign: "center" }}>
        <div className="timer">∞</div>
        <div className="tcap">unlimited</div>
      </div>
    );
  }

  const isLow = remaining <= 15;

  return (
    <div style={{ textAlign: "center" }}>
      <div className={`timer${isLow ? " low" : ""}`}>{formatSeconds(remaining)}</div>
      <div className="tcap">to pick</div>
    </div>
  );
}
