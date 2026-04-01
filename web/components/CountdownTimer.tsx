"use client";

import { useEffect, useState } from "react";

// World Cup 2026 opener: June 11, 2026 8:00 PM ET = June 12, 2026 00:00:00 UTC
const TARGET = new Date("2026-06-12T00:00:00Z").getTime();

function calcTimeLeft() {
  const diff = TARGET - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeLeft) return null;

  const units = [
    { label: "Days",    value: timeLeft.days },
    { label: "Hours",   value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
        FIFA World Cup 2026 Kickoff
      </p>
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {units.map(({ label, value }, i) => (
          <div key={label} className="flex items-center gap-3 sm:gap-5">
            <div className="flex flex-col items-center">
              <span className="font-mono text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl">
                {String(value).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                {label}
              </span>
            </div>
            {i < units.length - 1 && (
              <span className="mb-4 text-2xl font-bold text-slate-200">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
