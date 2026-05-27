import Link from "next/link";

import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { formatDollars } from "@/lib/earnings";
import { getTeamPlayers, POSITION_COLOR } from "@/lib/players";
import { TEAMS } from "@/lib/teams";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd", final: "Final",
};

export interface ProfileMatchItem {
  stage: string;
  oppCode: string;
  myScore: number;
  oppScore: number;
  earnedCents: number;
  isWin: boolean;
  isDraw: boolean;
  matchDate: Date | null;
  venue: string | null;
}

export interface ProfileTeam {
  teamCode: string;
  earnedCents: number;
  matchBreakdown: ProfileMatchItem[];
}

export interface ProfileContentProps {
  upcomingTournament: {
    id: string; name: string; year: number; status: string;
    draftDate: Date | null; teamsPerPlayer: number;
  } | null;
  activeTournamentName: string | null;
  totalEarnedCents: number;
  teams: ProfileTeam[];
  history: { id: string; name: string; year: number; teamCodes: string[] }[];
  draftHref?: string;
  disableTournamentLinks?: boolean;
}

function fmtPST(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true, timeZoneName: "short",
  });
}

export default function ProfileContent({
  upcomingTournament,
  activeTournamentName,
  totalEarnedCents,
  teams,
  history,
  draftHref = "/draft",
  disableTournamentLinks = false,
}: ProfileContentProps) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-extrabold text-zinc-900 dark:text-white">My Profile</h1>

      {/* Upcoming / Draft tournament card */}
      {upcomingTournament && (
        <section className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                {upcomingTournament.status === "draft" ? "Draft Open" : "Invited"}
              </div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {upcomingTournament.name} {upcomingTournament.year}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {upcomingTournament.teamsPerPlayer} teams per player · snake draft
              </div>
            </div>
            <Link
              href={draftHref}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              Open Draft →
            </Link>
          </div>
          {upcomingTournament.draftDate && (
            <div className="mt-4">
              <CountdownTimer
                targetISO={upcomingTournament.draftDate.toISOString()}
                label={`${upcomingTournament.name} ${upcomingTournament.year} Draft`}
              />
            </div>
          )}
        </section>
      )}

      {/* Active tournament section */}
      {activeTournamentName && (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{activeTournamentName}</div>
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-right">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Total earned</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatDollars(totalEarnedCents)}</div>
            </div>
          </div>

          {teams.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">You haven&apos;t drafted any teams yet.</p>
              <Link href={draftHref} className="mt-3 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Go to draft →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {teams.map((team) => {
                const teamData = TEAMS_BY_CODE.get(team.teamCode);
                const players = getTeamPlayers(team.teamCode);

                return (
                  <div key={team.teamCode} className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-white/5">
                      <CountryFlag code={team.teamCode} label={teamData?.name ?? team.teamCode} className="h-9 w-12 rounded-sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-zinc-900 dark:text-white text-lg leading-tight">{teamData?.name ?? team.teamCode}</div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">FIFA #{teamData?.rank} · Group {teamData?.group}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">earned</div>
                        <div className={`text-xl font-bold ${team.earnedCents > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                          {formatDollars(team.earnedCents)}
                        </div>
                      </div>
                    </div>

                    {players.length > 0 && (
                      <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5">
                        {players.map((p) => (
                          <span key={p.name} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${POSITION_COLOR[p.position]}`}>{p.position}</span>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {team.matchBreakdown.length > 0 ? (
                      <div className="divide-y divide-zinc-100 dark:divide-white/5">
                        {team.matchBreakdown.map((match, i) => {
                          const opp = TEAMS_BY_CODE.get(match.oppCode);
                          return (
                            <div key={i} className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <span className="w-16 shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{STAGE_LABELS[match.stage] ?? match.stage}</span>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <CountryFlag code={match.oppCode} label={opp?.name ?? match.oppCode} className="h-4 w-6 rounded-sm shrink-0" />
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">vs {opp?.name ?? match.oppCode}</span>
                                </div>
                                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${match.isWin ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : match.isDraw ? "bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                                  {match.myScore}–{match.oppScore}
                                </span>
                                <span className={`shrink-0 text-sm font-semibold w-14 text-right ${match.earnedCents > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>
                                  {match.earnedCents > 0 ? `+${formatDollars(match.earnedCents)}` : "—"}
                                </span>
                              </div>
                              {(match.venue || match.matchDate) && (
                                <div className="mt-0.5 pl-[76px] flex flex-wrap gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {match.matchDate && <span>{fmtPST(match.matchDate)}</span>}
                                  {match.venue && <span>· {match.venue}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-5 py-3 text-sm text-zinc-400 dark:text-zinc-500">No matches played yet</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">How you earn</h2>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {[
                { stage: "Group Win", earn: "$3 + $0.25/gd" },
                { stage: "Group Tie", earn: "$1.00" },
                { stage: "R16 Win", earn: "$5 + $0.50/gd" },
                { stage: "Quarter Final", earn: "$10 + $1/gd" },
                { stage: "Semi Final", earn: "$15 + $2/gd" },
                { stage: "3rd Place", earn: "$10 + $3/gd" },
                { stage: "Runner-up", earn: "$10 + $3/goal" },
                { stage: "Champion", earn: "$20 + $3/goal" },
                { stage: "Odds 2-jump", earn: "+$1 bonus" },
                { stage: "Odds 3-jump", earn: "+$2 bonus" },
              ].map(({ stage, earn }) => (
                <div key={stage} className="flex justify-between rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 px-3 py-2">
                  <span className="text-zinc-600 dark:text-zinc-400">{stage}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{earn}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tournament history */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Tournament History</h2>
          <div className="flex flex-col gap-3">
            {history.map((t) => {
              const historyInner = (
                <>
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">{t.name} {t.year}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.teamCodes.slice(0, 6).map((code) => {
                        const td = TEAMS_BY_CODE.get(code);
                        return (
                          <span key={code} className="flex items-center gap-1 rounded-md border border-zinc-100 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300">
                            <CountryFlag code={code} label={td?.name ?? code} className="h-3 w-4 rounded-sm shrink-0" />
                            {td?.name ?? code}
                          </span>
                        );
                      })}
                      {t.teamCodes.length > 6 && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">+{t.teamCodes.length - 6} more</span>
                      )}
                    </div>
                  </div>
                  {!disableTournamentLinks && <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">View →</span>}
                </>
              );
              const rowClass = "flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-4";
              return disableTournamentLinks ? (
                <div key={t.id} className={rowClass}>{historyInner}</div>
              ) : (
                <Link key={t.id} href={`/profile/tournament/${t.id}`} className={`${rowClass} transition-colors hover:bg-zinc-50 dark:hover:bg-white/10`}>{historyInner}</Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
