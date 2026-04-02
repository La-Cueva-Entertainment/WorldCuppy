"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatSeconds(s: number) {
  const sec = Math.max(0, Math.floor(s));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function DraftPickTimer({ seconds, key: _key }: { seconds: number; key?: number }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
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

  const isLow = remaining <= 10;

  return (
    <div className="flex flex-col items-center">
      <div className={`text-2xl font-mono font-bold tabular-nums ${
        isLow ? "text-rose-400 animate-pulse" : "text-green-300"
      }`}>
        {formatSeconds(remaining)}
      </div>
      <div className="text-xs text-zinc-500">to pick</div>
    </div>
  );
}
