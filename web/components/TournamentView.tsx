import type React from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { KnockoutBracket } from "@/components/KnockoutBracket";
import { LiveSync } from "@/components/LiveSync";
import PayoutRulesCard from "@/components/PayoutRulesCard";
import { formatDollars, type PayoutRules, DEFAULT_PAYOUT_RULES } from "@/lib/earnings";

export type TvPlayer = {
  id: string;
  name: string;
  earnings: number;
  teams: { code: string; name: string }[];
  colorIdx: number;
  isYou?: boolean;
};

export type TvPayout = {
  playerId: string;
  playerName: string;
  colorIdx: number;
  cents: number;
};

export type TvMatch = {
  id: string;
  stage: string;
  groupName?: string | null;
  homeTeam: string;
  homeTeamName: string;
  awayTeam: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinner?: string | null;
  played: boolean;
  matchDateISO?: string | null;
  venue?: string | null;
  payouts?: TvPayout[];
  homeOwnerNames?: string[];
  awayOwnerNames?: string[];
  homeOwnerColorIdx?: number | null;
  awayOwnerColorIdx?: number | null;
};

export interface TournamentViewProps {
  name: string;
  year: number;
  type?: string;
  status?: string | null;
  isDemo?: boolean;
  showLiveSync?: boolean;
  showTodayMatches?: boolean;
  draftDateISO?: string | null;
  players: TvPlayer[];
  todayMatches: TvMatch[];
  matchesByStage: Partial<Record<string, TvMatch[]>>;
  payoutRules?: PayoutRules | null;
  extraContent?: React.ReactNode;
}

const PLAYER_COLORS = [
  { dot: "bg-emerald-500", badge: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-400", teamBg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300" },
  { dot: "bg-amber-500",   badge: "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300",     text: "text-amber-700 dark:text-amber-400",   teamBg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300" },
  { dot: "bg-sky-500",     badge: "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300",             text: "text-sky-700 dark:text-sky-400",       teamBg: "bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20 text-sky-800 dark:text-sky-300" },
  { dot: "bg-rose-500",    badge: "bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300",         text: "text-rose-700 dark:text-rose-400",     teamBg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300" },
  { dot: "bg-purple-500",  badge: "bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300", text: "text-purple-700 dark:text-purple-400", teamBg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-800 dark:text-purple-300" },
  { dot: "bg-orange-500",  badge: "bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300", text: "text-orange-700 dark:text-orange-400", teamBg: "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-800 dark:text-orange-300" },
  { dot: "bg-cyan-500",    badge: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",         text: "text-cyan-700 dark:text-cyan-400",     teamBg: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-800 dark:text-cyan-300" },
  { dot: "bg-fuchsia-500", badge: "bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300", text: "text-fuchsia-700 dark:text-fuchsia-400", teamBg: "bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300" },
];

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage", r32: "Round of 32", r16: "Round of 16",
  qf: "Quarter Finals", sf: "Semi Finals", "3rd": "3rd Place", final: "Final",
};

const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "3rd", "final"];

function colorFor(idx: number) {
  return PLAYER_COLORS[idx % PLAYER_COLORS.length];
}

function fmtTime(iso: string | null | undefined, includeDate = false): string | null {
  if (!iso) return null;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/Los_Angeles",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  };
  if (includeDate) { opts.month = "short"; opts.day = "numeric"; }
  return new Date(iso).toLocaleString("en-US", opts);
}

export default function TournamentView({
  name, year, type, status, isDemo, showLiveSync, showTodayMatches = true, draftDateISO,
  players, todayMatches, matchesByStage, payoutRules, extraContent,
}: TournamentViewProps) {
  const hasAnyMatches = STAGE_ORDER.some((s) => (matchesByStage[s]?.length ?? 0) > 0);
  const rules = payoutRules ?? DEFAULT_PAYOUT_RULES;
  const isWorldCup = type === "world_cup" || !type;

  // Derive the current stage for the kicker: latest stage with any played match, else earliest with games
  const currentStageKey = (() => {
    for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
      const s = STAGE_ORDER[i]!;
      if (matchesByStage[s]?.some((m) => m.played)) return s;
    }
    for (const s of STAGE_ORDER) {
      if ((matchesByStage[s]?.length ?? 0) > 0) return s;
    }
    return null;
  })();
  const currentStageLabel = currentStageKey ? STAGE_LABELS[currentStageKey] : null;
  const kickerText = status === "active"
    ? [currentStageLabel, "Live"].filter(Boolean).join(" · ")
    : status === "complete" ? "Final · Complete"
    : status === "draft" ? "Snake Draft · Scheduled"
    : null;

  return (
    <main className="page">
      <div className="wrap">
      {isDemo && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="text-base">👀</span>
          <span><strong>Preview mode</strong> — mock data showing what the dashboard looks like during a World Cup.</span>
        </div>
      )}

      {draftDateISO && (
        <div className="mb-8">
          <CountdownTimer
            targetISO={draftDateISO}
            label={`${name} ${year} Draft`}
          />
        </div>
      )}

      <div className="mb-8 between" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div>
          {kickerText && <div className="kicker grass">{kickerText}</div>}
          <h1 style={{ marginTop: kickerText ? 4 : 0 }}>
            Standings
          </h1>
        </div>
        <div className="mt-1 flex items-center gap-3">
          {showLiveSync && <LiveSync />}
        </div>
      </div>

      {showTodayMatches && todayMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Today&apos;s Matches
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayMatches.map((m) => {
              const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
              const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
              const kickoff = fmtTime(m.matchDateISO);
              return (
                <div key={m.id} className={`rounded-2xl border p-4 ${
                  m.played
                    ? "border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5"
                    : "border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5"
                }`}>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    <span>{STAGE_LABELS[m.stage] ?? m.stage}{m.groupName ? ` · Grp ${m.groupName}` : ""}</span>
                    {kickoff && !m.played && <span>{kickoff}</span>}
                    {m.played && <span className="text-emerald-600 dark:text-emerald-400">Final</span>}
                  </div>
                  {m.venue && !m.played && (
                    <div className="mb-2 text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{m.venue}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${m.played && !homeWon ? "opacity-50" : ""}`}>
                      <CountryFlag code={m.homeTeam} label={m.homeTeamName} className="h-5 w-7 shrink-0" />
                      <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{m.homeTeamName}</span>
                    </div>
                    <div className="shrink-0 text-center">
                      {m.played ? (
                        <span className="font-mono text-base font-bold text-zinc-900 dark:text-white">
                          {m.homeScore}<span className="text-zinc-400 dark:text-zinc-500"> – </span>{m.awayScore}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">vs</span>
                      )}
                      {m.penaltyWinner && <div className="text-[10px] text-amber-600 dark:text-amber-400">pens</div>}
                    </div>
                    <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-1.5 ${m.played && !awayWon ? "opacity-50" : ""}`}>
                      <CountryFlag code={m.awayTeam} label={m.awayTeamName} className="h-5 w-7 shrink-0" />
                      <span className="truncate text-right text-sm font-semibold text-zinc-900 dark:text-white">{m.awayTeamName}</span>
                    </div>
                  </div>
                  {m.payouts && m.payouts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 dark:border-white/5 pt-3">
                      {m.payouts.map((p) => {
                        const c = colorFor(p.colorIdx);
                        return (
                          <span key={p.playerId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${c.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                            {p.playerName} +{formatDollars(p.cents)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="stand-grid">
        {/* Left: leaderboard */}
        <section className="card" style={{ padding: 8 }}>
          {players.map((player, i) => {
            const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
            const isYou = player.colorIdx === -1 /* set by page */ || false;
            const leader = players[0];
            const diff = leader && i > 0 ? leader.earnings - player.earnings : 0;
            return (
              <div key={player.id} className={`lb-row${player.isYou ? " you" : ""}`}>
                <div className={`lb-pos${medal ? " " + medal : ""}`}>{i + 1}</div>
                <div>
                  <Link href={`/standings/player/${player.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="lb-name">
                      <span className={`mdot m${player.colorIdx % 8}`} />
                      {player.name}
                      {player.isYou && <span className="tag-soft" style={{ fontWeight: 600 }}>you</span>}
                    </div>
                  </Link>
                  <div className="lb-teams">
                    {player.teams.map((t) => (
                      <CountryFlag key={t.code} code={t.code} label={t.name} className="flag-md fi-rect" />
                    ))}
                  </div>
                </div>
                <div className="lb-earn">
                  <div className="money pos">{formatDollars(player.earnings)}</div>
                  <div className="d">{i === 0 ? "leader" : `\u2212${formatDollars(diff)}`}</div>
                </div>
              </div>
            );
          })}
          {players.length === 0 && (
            <p style={{ padding: "24px 14px", color: "var(--ink-faint)", textAlign: "center" }}>
              No picks yet &mdash; go draft your teams!
            </p>
          )}
        </section>

        {/* Right: pool + payout rules */}
        <aside style={{ display: "grid", gap: 18, position: "sticky", top: 80 }}>
          <PayoutRulesCard rules={rules} isWorldCup={isWorldCup} />
        </aside>
      </div>

      {/* Full-width knockout bracket */}
      <KnockoutBracket matchesByStage={matchesByStage} />

      {/* Extra content (e.g. TeamsExplorer) */}
      {extraContent}
      </div>
    </main>
  );
}
