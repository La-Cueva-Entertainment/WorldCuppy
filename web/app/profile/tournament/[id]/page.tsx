import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, totalEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage", r32: "Round of 32", r16: "Round of 16",
  qf: "Quarter Finals", sf: "Semi Finals", "3rd": "3rd Place", final: "Final",
};

const PLAYER_COLORS = [
  "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300",
  "bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300",
  "bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300",
  "bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300",
  "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  "bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300",
];

export default async function TournamentDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await Promise.resolve(params);

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

  const [tournament, allPicks, allUsers, playedMatches, draftData] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, year: true, type: true, status: true, teamsPerPlayer: true },
    }),
    prisma.lineupPick.findMany({
      where: { tournamentId },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { userId: true, teamCode: true, pickNumber: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.match.findMany({
      where: { tournamentId, played: true },
      orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, matchDate: true, venue: true },
    }),
    prisma.tournamentDraft.findUnique({
      where: { tournamentId },
      select: { orderUserIds: true, status: true },
    }),
  ]);

  if (!tournament) notFound();

  // Authorization: user must have picks or be a participant
  const myPicks = allPicks.filter((p) => p.userId === userId);
  const isParticipant = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { userId: true },
  });

  if (myPicks.length === 0 && !isParticipant) redirect("/profile");

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const orderUserIds = (draftData?.orderUserIds as string[] | null) ?? [];

  // Build team → owner map for draft results display
  const pickByNumber = new Map(allPicks.filter((p) => p.pickNumber != null).map((p) => [p.pickNumber!, p]));
  const maxPick = allPicks.reduce((max, p) => Math.max(max, p.pickNumber ?? 0), 0);

  // Earnings calculation
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of allPicks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  const matchResults: MatchResult[] = playedMatches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const myTeamCodes = new Set(myPicks.map((p) => p.teamCode));
  const totalEarned = totalEarningsCents(matchResults, myTeamCodes);

  function getName(uid: string) {
    const u = userById.get(uid);
    return u?.name ?? u?.email?.split("@")[0] ?? "?";
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/profile" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
          ← Back to Profile
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-zinc-900 dark:text-white">
          {tournament.name} <span className="text-emerald-600 dark:text-emerald-400">{tournament.year}</span>
        </h1>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 capitalize">{tournament.status}</div>
      </div>

      {/* My earnings card */}
      {myPicks.length > 0 && (
        <section className="mb-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">My Teams</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {myPicks.map((p) => {
                  const team = TEAMS_BY_CODE.get(p.teamCode);
                  const teamMatchResults = matchResults.filter((m) => m.homeTeam === p.teamCode || m.awayTeam === p.teamCode);
                  const earned = totalEarningsCents(teamMatchResults, new Set([p.teamCode]));
                  return (
                    <div key={p.teamCode} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-white/5 px-3 py-1.5">
                      <CountryFlag code={p.teamCode} label={team?.name ?? p.teamCode} className="h-4 w-6 rounded-sm shrink-0" />
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{team?.name ?? p.teamCode}</span>
                      {earned > 0 && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatDollars(earned)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Total earned</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatDollars(totalEarned)}</div>
            </div>
          </div>
        </section>
      )}

      {/* Draft results */}
      {allPicks.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Draft Results</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5">
            {orderUserIds.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-white/5">
                {Array.from({ length: maxPick + 1 }, (_, pickNum) => {
                  const pick = pickByNumber.get(pickNum);
                  if (!pick) return null;
                  const team = TEAMS_BY_CODE.get(pick.teamCode);
                  const playerIdx = orderUserIds.indexOf(pick.userId);
                  const roundNum = Math.floor(pickNum / orderUserIds.length) + 1;
                  const isMyPick = pick.userId === userId;
                  const colorCls = PLAYER_COLORS[playerIdx >= 0 ? playerIdx % PLAYER_COLORS.length : 0];
                  return (
                    <div key={pickNum} className={`flex items-center gap-3 px-4 py-3 ${isMyPick ? "bg-emerald-50 dark:bg-emerald-500/5" : ""}`}>
                      <div className="w-8 text-center text-xs font-mono text-zinc-400 dark:text-zinc-500">
                        #{pickNum + 1}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${colorCls}`}>
                        {getName(pick.userId)}
                      </span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CountryFlag code={pick.teamCode} label={team?.name ?? pick.teamCode} className="h-4 w-6 rounded-sm shrink-0" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{team?.name ?? pick.teamCode}</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">Rnd {roundNum}</span>
                      </div>
                      {isMyPick && <span className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">★ Mine</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-white/5">
                {allPicks.map((pick, i) => {
                  const team = TEAMS_BY_CODE.get(pick.teamCode);
                  const isMyPick = pick.userId === userId;
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${isMyPick ? "bg-emerald-50 dark:bg-emerald-500/5" : ""}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CountryFlag code={pick.teamCode} label={team?.name ?? pick.teamCode} className="h-4 w-6 rounded-sm shrink-0" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{team?.name ?? pick.teamCode}</span>
                      </div>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">{getName(pick.userId)}</span>
                      {isMyPick && <span className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">★ Mine</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Match results */}
      {playedMatches.length > 0 && myPicks.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Match Results</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 divide-y divide-zinc-100 dark:divide-white/5">
            {playedMatches.map((m, i) => {
              const myHome = myTeamCodes.has(m.homeTeam);
              const myAway = myTeamCodes.has(m.awayTeam);
              if (!myHome && !myAway) return null;

              const mr: MatchResult = {
                stage: m.stage as MatchResult["stage"],
                tournamentType: tournament.type as MatchResult["tournamentType"],
                homeTeam: m.homeTeam, awayTeam: m.awayTeam,
                homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
                penaltyWinner: m.penaltyWinner ?? null,
              };
              const earned = matchEarningsCents(mr, myHome, myAway);
              const homeWon = (m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam;
              const awayWon = (m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam;

              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{STAGE_LABELS[m.stage] ?? m.stage}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex flex-1 items-center gap-2 min-w-0 ${!homeWon && (m.homeScore !== null) ? "opacity-50" : ""}`}>
                      <CountryFlag code={m.homeTeam} label={TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam} className="h-5 w-7 shrink-0" />
                      <span className={`text-sm font-semibold truncate ${myHome ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-zinc-900 dark:text-white">
                      {m.homeScore} – {m.awayScore}
                    </span>
                    <div className={`flex flex-1 flex-row-reverse items-center gap-2 min-w-0 ${!awayWon && (m.awayScore !== null) ? "opacity-50" : ""}`}>
                      <CountryFlag code={m.awayTeam} label={TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam} className="h-5 w-7 shrink-0" />
                      <span className={`text-sm font-semibold truncate text-right ${myAway ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam}
                      </span>
                    </div>
                    <span className={`w-14 shrink-0 text-right text-sm font-semibold ${earned > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600"}`}>
                      {earned > 0 ? `+${formatDollars(earned)}` : "—"}
                    </span>
                  </div>
                  {m.penaltyWinner && (
                    <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400 text-center">Won on penalties</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
