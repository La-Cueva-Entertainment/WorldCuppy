"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

import { LeagueDropdown } from "@/components/LeagueDropdown";

type LeagueOption = { id: string; name: string };

export function AuthButtons({
  signedIn,
  leagues,
  activeLeagueId,
  activeLeagueName,
  picksCount,
}: {
  signedIn: boolean;
  leagues?: LeagueOption[];
  activeLeagueId?: string | null;
  activeLeagueName?: string | null;
  picksCount?: number | null;
}) {
  if (signedIn) {
    return (
      <div className="flex items-center gap-2">
        {typeof picksCount === "number" ? (
          <div className="hidden items-center gap-2 text-xs text-zinc-200/90 md:flex">
            <span>
              <span className="font-semibold text-white">{picksCount}</span>/8 Teams
            </span>
          </div>
        ) : null}

        <div className="hidden items-center gap-2 sm:flex">
          <div className="text-xs font-medium text-zinc-200">League:</div>
          {leagues && leagues.length > 1 ? (
            <LeagueDropdown
              leagues={leagues}
              activeLeagueId={activeLeagueId}
              className="h-9 max-w-[14rem] rounded-xl border border-white/15 bg-white/5 pl-3 pr-9 text-xs font-medium text-white outline-none hover:bg-white/10 disabled:opacity-60"
            />
          ) : (
            <Link
              href="/dashboard"
              title="Go to dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-inset ring-white/5 hover:bg-white/10"
            >
              {activeLeagueName ?? "—"}
            </Link>
          )}
        </div>

        <Link
          href="/matchups"
          className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
        >
          Matchups
        </Link>
        {activeLeagueId ? (
          <Link
            href={`/leagues/${activeLeagueId}/managers`}
            className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Leaderboards
          </Link>
        ) : null}
        <Link
          href="/lineup"
          className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
        >
          My Lineup
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex h-9 items-center rounded-xl bg-white/5 px-3 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="text-sm font-medium text-zinc-200 hover:text-white"
      >
        Sign in
      </Link>
    </div>
  );
}
