"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CountryFlag } from "@/components/CountryFlag";

type TeamCardData = {
  code: string;
  name: string;
  rank: number;
};

type TierData = {
  key: string;
  labelBase: string;
  label: string;
  rangeLabel: string;
  teams: TeamCardData[];
};

type TakenByInfo = {
  label: string;
  colorIndex: number;
};

const OWNER_BADGE_STYLES = [
  { dot: "bg-rose-400", bg: "bg-rose-500/10", ring: "ring-rose-500/30", text: "text-rose-100" },
  { dot: "bg-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/30", text: "text-amber-100" },
  { dot: "bg-lime-400", bg: "bg-lime-500/10", ring: "ring-lime-500/30", text: "text-lime-100" },
  { dot: "bg-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", text: "text-emerald-100" },
  { dot: "bg-cyan-400", bg: "bg-cyan-500/10", ring: "ring-cyan-500/30", text: "text-cyan-100" },
  { dot: "bg-sky-400", bg: "bg-sky-500/10", ring: "ring-sky-500/30", text: "text-sky-100" },
  { dot: "bg-indigo-400", bg: "bg-indigo-500/10", ring: "ring-indigo-500/30", text: "text-indigo-100" },
  { dot: "bg-fuchsia-400", bg: "bg-fuchsia-500/10", ring: "ring-fuchsia-500/30", text: "text-fuchsia-100" },
] as const;

function getOwnerStyle(idx: number) {
  const i = Number.isFinite(idx) ? Math.abs(Math.floor(idx)) : 0;
  return OWNER_BADGE_STYLES[i % OWNER_BADGE_STYLES.length];
}

export default function TieredTeamsBox({
  tiers,
  initialTierKey,
  takenTeamCodes,
  myTeamCodes,
  takenBy,
  canDraft,
  canPickNow,
  activeLeagueId,
  picksCount,
  lineupSize,
  draftTeamAction,
  showDraftControls = true,
}: {
  tiers: TierData[];
  initialTierKey?: string;
  takenTeamCodes: string[];
  myTeamCodes: string[];
  takenBy?: Record<string, TakenByInfo>;
  canDraft: boolean;
  canPickNow: boolean;
  activeLeagueId?: string;
  picksCount: number;
  lineupSize: number;
  draftTeamAction?: (formData: FormData) => Promise<void>;
  showDraftControls?: boolean;
}) {
  const selectorRef = useRef<HTMLDivElement | null>(null);
  const suppressHoverTimeoutRef = useRef<number | null>(null);
  const [suppressHoverGlow, setSuppressHoverGlow] = useState(false);
  const tierKeys = useMemo(() => new Set(tiers.map((t) => t.key)), [tiers]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedTierKey, setSelectedTierKey] = useState(() => {
    const raw = String(initialTierKey ?? "all");
    return tierKeys.has(raw) ? raw : "all";
  });

  const urlTierKey = useMemo(() => {
    const raw = String(searchParams.get("tier") ?? "all");
    return tierKeys.has(raw) ? raw : "all";
  }, [searchParams, tierKeys]);

  useEffect(() => {
    // If the URL says tier4, the dropdown should say tier4.
    if (urlTierKey !== selectedTierKey) {
      setSelectedTierKey(urlTierKey);
    }
  }, [urlTierKey, selectedTierKey]);

  const makeReturnTo = useMemo(() => {
    return (tierKey: string) => {
      if (!tierKey || tierKey === "all") return pathname;
      return `${pathname}?tier=${encodeURIComponent(tierKey)}`;
    };
  }, [pathname]);

  const takenSet = useMemo(
    () => new Set(takenTeamCodes.map((c) => c.toLowerCase())),
    [takenTeamCodes],
  );

  const takenByMap = useMemo(() => {
    const out = new Map<string, TakenByInfo>();
    if (!takenBy) return out;
    for (const [k, v] of Object.entries(takenBy)) {
      out.set(k.toLowerCase(), v);
    }
    return out;
  }, [takenBy]);

  const mineSet = useMemo(
    () => new Set(myTeamCodes.map((c) => c.toLowerCase())),
    [myTeamCodes],
  );

  const visibleTiers = useMemo(() => {
    if (selectedTierKey === "all") return tiers;
    return tiers.filter((t) => t.key === selectedTierKey);
  }, [selectedTierKey, tiers]);

  const allTeams = useMemo(() => {
    return tiers
      .flatMap((t) => t.teams)
      .slice()
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }, [tiers]);

  function handleTierChange(nextTierKey: string) {
    const beforeTop = selectorRef.current?.getBoundingClientRect().top ?? null;

    if (suppressHoverTimeoutRef.current != null) {
      window.clearTimeout(suppressHoverTimeoutRef.current);
    }
    setSuppressHoverGlow(true);
    suppressHoverTimeoutRef.current = window.setTimeout(() => {
      setSuppressHoverGlow(false);
      suppressHoverTimeoutRef.current = null;
    }, 200);

    setSelectedTierKey(nextTierKey);

    // Persist tier selection so server-action redirects land you back here.
    const nextUrl = makeReturnTo(nextTierKey);
    router.replace(nextUrl, { scroll: false });

    // Keep the selector visually stationary when the list height changes.
    requestAnimationFrame(() => {
      const afterTop = selectorRef.current?.getBoundingClientRect().top ?? null;
      if (beforeTop == null || afterTop == null) return;
      const delta = afterTop - beforeTop;
      if (Math.abs(delta) < 1) return;
      window.scrollBy({ top: delta, left: 0 });
    });
  }


  return (
    <div className="mt-6">
      <div
        ref={selectorRef}
        className="rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ring-inset ring-white/5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-zinc-200">Tier</div>
          <select
            value={selectedTierKey}
            onChange={(e) => handleTierChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-3 text-sm text-white outline-none focus:border-emerald-500/40 sm:w-72"
          >
            <option value="all">All tiers</option>
            {tiers.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedTierKey === "all" ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-semibold text-white">All teams</div>
            <div className="text-xs text-zinc-400">{allTeams.length} teams</div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {allTeams.map((t) => {
              const mine = mineSet.has(t.code.toLowerCase());
              const taken = takenSet.has(t.code.toLowerCase());
              const takenInfo = taken ? takenByMap.get(t.code.toLowerCase()) ?? null : null;
              const tierForSubmit = selectedTierKey;
              const returnTo = makeReturnTo(tierForSubmit);
              const lineupFull = picksCount >= lineupSize;
              const canDraftThis = canDraft && canPickNow && !lineupFull && !taken;

              const canShowDraftButton =
                showDraftControls && Boolean(draftTeamAction) && Boolean(activeLeagueId);

              return (
                <div
                  key={t.code}
                  className="rounded-xl border border-white/10 bg-zinc-950/40 p-2.5 ring-1 ring-inset ring-white/5"
                >
                  <div className="flex items-center gap-2">
                    <CountryFlag code={t.code} label={t.name} className="h-5 w-7" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-white">{t.name}</div>
                    </div>
                    <div className="text-xs font-semibold text-emerald-100">#{t.rank}</div>
                    {taken ? (
                      takenInfo ? (
                        <div
                          className={
                            "inline-flex h-7 items-center gap-2 rounded-lg px-2 text-[11px] font-medium ring-1 ring-inset " +
                            getOwnerStyle(takenInfo.colorIndex).bg +
                            " " +
                            getOwnerStyle(takenInfo.colorIndex).ring +
                            " " +
                            getOwnerStyle(takenInfo.colorIndex).text
                          }
                          title={mine ? "You drafted this team" : "This team has been drafted"}
                        >
                          <span
                            className={"h-2 w-2 rounded-full " + getOwnerStyle(takenInfo.colorIndex).dot}
                            aria-hidden
                          />
                          <span className="max-w-[7.5rem] truncate">{takenInfo.label}</span>
                        </div>
                      ) : (
                        <div
                          className={
                            "inline-flex h-7 items-center justify-center rounded-lg bg-white/5 px-2 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 opacity-80"
                          }
                          title={mine ? "You drafted this team" : "This team has been drafted"}
                        >
                          Taken
                        </div>
                      )
                    ) : canShowDraftButton ? (
                      <form action={draftTeamAction}>
                        <input type="hidden" name="leagueId" value={activeLeagueId} />
                        <input type="hidden" name="teamCode" value={t.code} />
                        <input type="hidden" name="tier" value={tierForSubmit} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button
                          type="submit"
                          disabled={!canDraftThis}
                          className={
                            "inline-flex h-7 cursor-pointer items-center justify-center rounded-lg px-2 text-[11px] font-medium ring-1 ring-inset transition disabled:cursor-not-allowed " +
                            (!canDraftThis
                              ? "bg-white/5 text-zinc-300 ring-white/10 opacity-70"
                              : "bg-sky-500/20 text-sky-50 ring-sky-500/30 hover:bg-sky-500/25")
                          }
                          title={
                            !canDraft
                              ? "Join a league to draft"
                              : !canPickNow
                                ? "Not your turn"
                                : lineupFull
                                  ? `Lineup is full (${picksCount}/${lineupSize})`
                                  : "Draft this team"
                          }
                        >
                          Draft
                        </button>
                      </form>
                    ) : (
                      <div className="inline-flex h-7 items-center justify-center rounded-lg bg-white/5 px-2 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 opacity-80">
                        Available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {visibleTiers.map((tier) => {
            if (tier.teams.length === 0) return null;

            const tierForSubmit = tier.key;
            const returnTo = makeReturnTo(tierForSubmit);

            return (
              <div key={tier.key}>
                <div className="flex items-baseline justify-between">
                  <div className="text-sm font-semibold text-white">
                    {tier.labelBase}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {tier.rangeLabel} · {tier.teams.length} teams
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {tier.teams.map((t) => {
                    const mine = mineSet.has(t.code.toLowerCase());
                    const taken = takenSet.has(t.code.toLowerCase());
                    const takenInfo = taken ? takenByMap.get(t.code.toLowerCase()) ?? null : null;
                    const lineupFull = picksCount >= lineupSize;
                    const canDraftThis = canDraft && canPickNow && !lineupFull && !taken;
                    const canShowDraftButton =
                      showDraftControls && Boolean(draftTeamAction) && Boolean(activeLeagueId);

                    return (
                      <div
                        key={t.code}
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/40 p-4 ring-1 ring-inset ring-white/5 backdrop-blur transition hover:border-white/15"
                      >
                        {suppressHoverGlow ? null : (
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                            <div className="absolute -top-24 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
                          </div>
                        )}

                        <div className="relative flex items-start gap-3">
                          <CountryFlag
                            code={t.code}
                            label={t.name}
                            className="h-7 w-10"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {t.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-400">
                              FIFA rank #{t.rank}
                            </div>
                          </div>

                          <div className="ml-auto text-right">
                              <div className="text-[11px] font-medium text-zinc-300">Rank</div>
                              <div className="text-base font-semibold text-emerald-100">#{t.rank}</div>
                          </div>
                        </div>

                        <div className="relative mt-3 flex items-center gap-2">
                          {taken ? (
                            takenInfo ? (
                              <div
                                className={
                                  "inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium ring-1 ring-inset " +
                                  getOwnerStyle(takenInfo.colorIndex).bg +
                                  " " +
                                  getOwnerStyle(takenInfo.colorIndex).ring +
                                  " " +
                                  getOwnerStyle(takenInfo.colorIndex).text
                                }
                                title={mine ? "You drafted this team" : "This team has been drafted"}
                              >
                                <span
                                  className={
                                    "h-2.5 w-2.5 rounded-full " +
                                    getOwnerStyle(takenInfo.colorIndex).dot
                                  }
                                  aria-hidden
                                />
                                <span className="truncate">{takenInfo.label}</span>
                              </div>
                            ) : (
                              <div
                                className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-white/5 px-3 text-sm font-medium text-zinc-300 ring-1 ring-inset ring-white/10 opacity-80"
                                title={mine ? "You drafted this team" : "This team has been drafted"}
                              >
                                Taken
                              </div>
                            )
                          ) : canShowDraftButton ? (
                            <form action={draftTeamAction} className="flex-1">
                              <input type="hidden" name="leagueId" value={activeLeagueId} />
                              <input type="hidden" name="teamCode" value={t.code} />
                              <input type="hidden" name="tier" value={tierForSubmit} />
                              <input type="hidden" name="returnTo" value={returnTo} />
                              <button
                                type="submit"
                                disabled={!canDraftThis}
                                className={
                                  "inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-xl px-3 text-sm font-medium ring-1 ring-inset transition disabled:cursor-not-allowed " +
                                  (!canDraftThis
                                    ? "bg-white/5 text-zinc-300 ring-white/10 opacity-70"
                                    : "bg-sky-500/20 text-sky-50 ring-sky-500/30 hover:bg-sky-500/25")
                                }
                                title={
                                  !canDraft
                                    ? "Join a league to draft"
                                    : !canPickNow
                                      ? "Not your turn"
                                      : lineupFull
                                        ? `Lineup is full (${picksCount}/${lineupSize})`
                                        : "Draft this team"
                                }
                              >
                                Draft
                              </button>
                            </form>
                          ) : (
                            <div className="flex-1">
                              <div className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-white/5 px-3 text-sm font-medium text-zinc-300 ring-1 ring-inset ring-white/10 opacity-80">
                                Available
                              </div>
                            </div>
                          )}

                          <div className="text-[11px] text-zinc-400">
                            {taken
                              ? "Drafted"
                              : canShowDraftButton
                                ? "Draft"
                                : "Available"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
