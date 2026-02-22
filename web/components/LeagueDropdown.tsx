"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type LeagueOption = {
  id: string;
  name: string;
};

export function LeagueDropdown({
  leagues,
  activeLeagueId,
  className,
}: {
  leagues: LeagueOption[];
  activeLeagueId?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(activeLeagueId ?? "");

  async function setActiveLeague(nextLeagueId: string) {
    const resp = await fetch("/api/active-league", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId: nextLeagueId }),
    });

    if (!resp.ok) {
      // Keep UX minimal: revert to previous value on failure.
      setValue(activeLeagueId ?? "");
      return;
    }

    router.refresh();
  }

  if (leagues.length <= 1) return null;

  return (
    <select
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        startTransition(() => {
          void setActiveLeague(next);
        });
      }}
      disabled={pending}
      className={
        className ??
        "h-10 max-w-[14rem] rounded-full border border-white/15 bg-zinc-900/70 pl-3 pr-9 text-xs font-medium text-white outline-none hover:bg-zinc-800/70 disabled:opacity-60"
      }
      aria-label="Switch league"
    >
      {leagues.map((l) => (
        <option key={l.id} value={l.id} className="bg-zinc-950">
          {l.name}
        </option>
      ))}
    </select>
  );
}
