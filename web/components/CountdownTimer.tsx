"use client";

import { useEffect, useState } from "react";

// Fallback: World Cup 2026 opener June 11 8 PM ET = June 12 00:00 UTC
const WC_KICKOFF = new Date("2026-06-12T00:00:00Z").getTime();

function calcTimeLeft(target: number) {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  targetISO?: string | null;
  label?: string;
}

export function CountdownTimer({ targetISO, label }: CountdownTimerProps) {
  const target = targetISO ? new Date(targetISO).getTime() : WC_KICKOFF;
  const displayLabel = label ?? "FIFA World Cup 2026 Kickoff";

  const [timeLeft, setTimeLeft] = useState<ReturnType<typeof calcTimeLeft>>(null);

  useEffect(() => {
    setTimeLeft(calcTimeLeft(target));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!timeLeft) return null;

  const units = [
    { label: "Days",    value: timeLeft.days },
    { label: "Hours",   value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-5">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {displayLabel}
      </p>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {units.map(({ label, value }, i) => (
          <div key={label} className="flex items-center gap-3 sm:gap-5">
            <div className="flex flex-col items-center">
              <span className="font-mono text-3xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                {String(value).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {label}
              </span>
            </div>
            {i < units.length - 1 && (
              <span className="mb-4 text-2xl font-bold text-zinc-200 dark:text-zinc-700">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
