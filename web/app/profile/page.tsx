import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, totalEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";
import { getTeamPlayers, POSITION_COLOR } from "@/lib/players";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd", final: "Final",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }
  if (!userId) redirect("/login");

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, type: true, teamsPerPlayer: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">No active tournament</h1>
        <Link href="/" className="mt-4 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Standings →</Link>
      </main>
    );
  }

  const [myPicks, matches, completedTournaments] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id, userId },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { teamCode: true, pickNumber: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, matchDate: true, venue: true },
    }),
    prisma.tournament.findMany({
      where: {
        status: "complete",
        picks: { some: { userId } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, year: true, type: true },
    }),
  ]);

  const myTeamCodes = new Set(myPicks.map((p) => p.teamCode));
  const matchMeta = new Map(matches.map((m) => [
    `${m.homeTeam}|${m.awayTeam}|${m.stage}`,
    { matchDate: m.matchDate, venue: m.venue },
  ]));

  function fmtPST(d: Date | null) {
    if (!d) return null;
    return d.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
      hour12: true, timeZoneName: "short",
    });
  }

  const matchResults: MatchResult[] = matches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const totalEarned = totalEarningsCents(matchResults, myTeamCodes);

  const pastPicksByTournament = completedTournaments.length > 0
    ? await prisma.lineupPick.findMany({
        where: {
          userId,
          tournamentId: { in: completedTournaments.map((t) => t.id) },
        },
        select: { tournamentId: true, teamCode: true },
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">My Profile</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{tournament.name} {tournament.year}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-right">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Total earned</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatDollars(totalEarned)}</div>
        </div>
      </div>

      {myPicks.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">You haven&apos;t drafted any teams yet.</p>
          <Link href="/draft" className="mt-3 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Go to draft →</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {myPicks.map((pick) => {
            const team = TEAMS_BY_CODE.get(pick.teamCode);
            const players = getTeamPlayers(pick.teamCode);
            const teamMatches = matchResults.filter((m) => m.homeTeam === pick.teamCode || m.awayTeam === pick.teamCode);
            const earned = totalEarningsCents(teamMatches, new Set([pick.teamCode]));

            const matchBreakdown = teamMatches.map((m) => {
              const ownsHome = m.homeTeam === pick.teamCode;
              const oppCode = ownsHome ? m.awayTeam : m.homeTeam;
              const oppTeam = TEAMS_BY_CODE.get(oppCode);
              const myScore = ownsHome ? m.homeScore : m.awayScore;
              const oppScore = ownsHome ? m.awayScore : m.homeScore;
              const matchEarned = matchEarningsCents(m, ownsHome, !ownsHome);
              const isWin = myScore > oppScore;
              const isDraw = myScore === oppScore;
              const meta = matchMeta.get(`${m.homeTeam}|${m.awayTeam}|${m.stage}`);
              return { m, oppCode, oppTeam, myScore, oppScore, matchEarned, isWin, isDraw, meta };
            });

            return (
              <div key={pick.teamCode} className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 dark:border-white/5">
                  <CountryFlag code={pick.teamCode} label={team?.name ?? pick.teamCode} className="h-9 w-12 rounded-sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-zinc-900 dark:text-white text-lg leading-tight">{team?.name ?? pick.teamCode}</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">FIFA #{team?.rank} · Group {team?.group}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-zinc-400 dark:text-zinc-500">earned</div>
                    <div className={`text-xl font-bold ${earned > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"}`}>{formatDollars(earned)}</div>
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

                {matchBreakdown.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-white/5">
                    {matchBreakdown.map(({ m, oppCode, oppTeam, myScore, oppScore, matchEarned, isWin, isDraw, meta }, i) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{STAGE_LABELS[m.stage] ?? m.stage}</span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CountryFlag code={oppCode} label={oppTeam?.name ?? oppCode} className="h-4 w-6 rounded-sm shrink-0" />
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">vs {oppTeam?.name ?? oppCode}</span>
                          </div>
                          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${isWin ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : isDraw ? "bg-zinc-100 dark:bg-white/10 text-zinc-500 dark:text-zinc-400" : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"}`}>
                            {myScore}–{oppScore}
                          </span>
                          <span className={`shrink-0 text-sm font-semibold w-14 text-right ${matchEarned > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>
                            {matchEarned > 0 ? `+${formatDollars(matchEarned)}` : "—"}
                          </span>
                        </div>
                        {(meta?.venue || meta?.matchDate) && (
                          <div className="mt-0.5 pl-[76px] flex flex-wrap gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                            {meta.matchDate && <span>{fmtPST(new Date(meta.matchDate))}</span>}
                            {meta.venue && <span>· {meta.venue}</span>}
                          </div>
                        )}
                      </div>
                    ))}
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

      {completedTournaments.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Tournament History</h2>
          <div className="flex flex-col gap-4">
            {completedTournaments.map((t) => {
              const pastPicks = pastPicksByTournament.filter((p) => p.tournamentId === t.id);
              return (
                <div key={t.id} className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
                  <div className="mb-3 font-bold text-zinc-900 dark:text-white">{t.name} {t.year}</div>
                  {pastPicks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pastPicks.map((p) => {
                        const team = TEAMS_BY_CODE.get(p.teamCode);
                        return (
                          <span key={p.teamCode} className="flex items-center gap-1.5 rounded-lg border border-zinc-100 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                            <CountryFlag code={p.teamCode} label={team?.name ?? p.teamCode} className="h-4 w-6 rounded-sm shrink-0" />
                            {team?.name ?? p.teamCode}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">No picks recorded.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
