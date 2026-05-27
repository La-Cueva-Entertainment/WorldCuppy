import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { LiveSync } from "@/components/LiveSync";
import { formatDollars } from "@/lib/earnings";

export type TvPlayer = {
  id: string;
  name: string;
  earnings: number;
  teams: { code: string; name: string }[];
  colorIdx: number;
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
  status?: string | null;
  isDemo?: boolean;
  showLiveSync?: boolean;
  showTodayMatches?: boolean;
  draftDateISO?: string | null;
  players: TvPlayer[];
  todayMatches: TvMatch[];
  matchesByStage: Partial<Record<string, TvMatch[]>>;
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
  name, year, status, isDemo, showLiveSync, showTodayMatches = true, draftDateISO,
  players, todayMatches, matchesByStage,
}: TournamentViewProps) {
  const hasAnyMatches = STAGE_ORDER.some((s) => (matchesByStage[s]?.length ?? 0) > 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
          {name} <span className="text-emerald-600 dark:text-emerald-400">{year}</span>
        </h1>
        <div className="mt-1 flex items-center gap-3">
          {!isDemo && status && <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize">{status}</p>}
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

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Standings */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Standings</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/5 text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="w-8 py-3 pl-4 text-left font-medium">#</th>
                  <th className="py-3 text-left font-medium">Player</th>
                  <th className="py-3 pr-4 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => {
                  const c = colorFor(player.colorIdx);
                  return (
                    <tr key={player.id} className="border-b border-zinc-50 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-white/5">
                      <td className="py-3 pl-4 font-mono text-xs text-zinc-400 dark:text-zinc-500">{i + 1}</td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <span className="font-semibold text-zinc-900 dark:text-white">{player.name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pl-4">
                            {player.teams.map((t) => (
                              <span key={t.code} className={`flex min-w-0 items-center gap-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-xs font-medium ${c.teamBg}`}>
                                <CountryFlag code={t.code} label={t.name} className="h-3 w-4 shrink-0" />
                                <span className="truncate">{t.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold tabular-nums ${c.text}`}>
                        {formatDollars(player.earnings)}
                      </td>
                    </tr>
                  );
                })}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                      No picks yet — go draft your teams!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bracket */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Tournament Bracket</h2>
          <div className="space-y-6">
            {STAGE_ORDER.map((stage) => {
              const stageMatches = matchesByStage[stage] ?? [];
              if (stageMatches.length === 0) return null;
              return (
                <div key={stage}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{STAGE_LABELS[stage] ?? stage}</h3>
                    <div className="h-px flex-1 bg-zinc-100 dark:bg-white/10" />
                  </div>
                  <div className={`grid gap-2 ${stage === "group" ? "sm:grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
                    {stageMatches.map((m) => {
                      const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                      const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
                      const homeOwner = (m.homeOwnerNames ?? []).join(" & ");
                      const awayOwner = (m.awayOwnerNames ?? []).join(" & ");
                      const homeColor = m.homeOwnerColorIdx != null ? colorFor(m.homeOwnerColorIdx) : null;
                      const awayColor = m.awayOwnerColorIdx != null ? colorFor(m.awayOwnerColorIdx) : null;
                      return (
                        <div key={m.id} className={`overflow-hidden rounded-xl border bg-white dark:bg-white/5 ${
                          m.played ? "border-zinc-200 dark:border-white/10" : "border-zinc-100 dark:border-white/5 opacity-60"
                        }`}>
                          {(m.groupName || (!m.played && m.matchDateISO)) && (
                            <div className="flex justify-between border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              {m.groupName ? <span>Group {m.groupName}</span> : <span />}
                              {!m.played && m.matchDateISO && <span>{fmtTime(m.matchDateISO, true)}</span>}
                            </div>
                          )}
                          {!m.played && m.venue && (
                            <div className="truncate border-b border-zinc-100 dark:border-white/5 px-3 py-1 text-[10px] text-zinc-400 dark:text-zinc-500">{m.venue}</div>
                          )}
                          <div className="flex items-stretch">
                            <div className={`flex flex-1 items-center gap-2.5 px-3 py-3 ${homeWon ? "" : m.played ? "opacity-50" : ""}`}>
                              <CountryFlag code={m.homeTeam} label={m.homeTeamName} className="h-6 w-8 shrink-0 rounded shadow-sm" />
                              <div className="min-w-0">
                                <div className={`text-sm font-semibold ${homeWon ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}>{m.homeTeamName}</div>
                                {homeOwner && <div className={`text-[10px] font-medium ${homeColor ? homeColor.text : "text-zinc-400 dark:text-zinc-500"}`}>{homeOwner}</div>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-center justify-center border-x border-zinc-100 dark:border-white/5 px-3">
                              {m.played ? (
                                <>
                                  <div className="flex items-center gap-2 font-mono text-lg font-bold leading-none">
                                    <span className={homeWon ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}>{m.homeScore}</span>
                                    <span className="text-zinc-300 dark:text-zinc-600">–</span>
                                    <span className={awayWon ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-500"}>{m.awayScore}</span>
                                  </div>
                                  {m.penaltyWinner && <span className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">pens</span>}
                                </>
                              ) : (
                                <span className="text-xs font-medium text-zinc-300 dark:text-zinc-600">vs</span>
                              )}
                            </div>
                            <div className={`flex flex-1 flex-row-reverse items-center gap-2.5 px-3 py-3 ${awayWon ? "" : m.played ? "opacity-50" : ""}`}>
                              <CountryFlag code={m.awayTeam} label={m.awayTeamName} className="h-6 w-8 shrink-0 rounded shadow-sm" />
                              <div className="min-w-0 text-right">
                                <div className={`text-sm font-semibold ${awayWon ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}>{m.awayTeamName}</div>
                                {awayOwner && <div className={`text-[10px] font-medium ${awayColor ? awayColor.text : "text-zinc-400 dark:text-zinc-500"}`}>{awayOwner}</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!hasAnyMatches && (
              <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                No matches entered yet. Admin can add them via the Admin panel.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
