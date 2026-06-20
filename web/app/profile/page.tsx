import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchEarningsCents, totalEarningsCents, resolvePayoutRules, type MatchResult } from "@/lib/earnings";
import ProfileContent, { type ProfileTeam, type ProfileMatchItem } from "@/components/ProfileContent";

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

  const upcomingParticipation = await prisma.tournamentParticipant.findFirst({
    where: { userId, tournament: { status: { in: ["upcoming", "draft"] } } },
    select: {
      teamName: true,
      tournament: {
        select: { id: true, name: true, year: true, status: true, draftDate: true, teamsPerPlayer: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  const upcomingTournament = upcomingParticipation?.tournament ?? null;
  const upcomingTeamName = upcomingParticipation?.teamName ?? null;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const userName = currentUser?.name ?? session.user.name ?? null;

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, type: true, payoutRules: true },
  });

  if (!tournament && !upcomingTournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">No active tournament</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">You&apos;re not enrolled in any upcoming tournament.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Home →</Link>
      </main>
    );
  }

  type RawMatch = {
    stage: string; homeTeam: string; awayTeam: string;
    homeScore: number | null; awayScore: number | null;
    penaltyWinner: string | null; matchDate: Date | null; venue: string | null;
  };

  const [myPicks, rawMatches, completedTournaments] = tournament
    ? await Promise.all([
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
          where: { status: "complete", picks: { some: { userId } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, year: true },
        }),
      ])
    : [[], [], []];

  const typed = rawMatches as RawMatch[];

  const rules = resolvePayoutRules(tournament?.payoutRules as Record<string, number> | null);

  const matchResults: MatchResult[] = typed.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const myTeamCodes = new Set((myPicks as { teamCode: string }[]).map((p) => p.teamCode));
  const totalEarned = totalEarningsCents(matchResults, myTeamCodes, rules);

  const teams: ProfileTeam[] = (myPicks as { teamCode: string }[]).map((pick) => {
    const teamMatches = matchResults.filter((m) => m.homeTeam === pick.teamCode || m.awayTeam === pick.teamCode);
    const earnedCents = totalEarningsCents(teamMatches, new Set([pick.teamCode]), rules);

    const matchBreakdown: ProfileMatchItem[] = teamMatches.map((m) => {
      const ownsHome = m.homeTeam === pick.teamCode;
      const oppCode = ownsHome ? m.awayTeam : m.homeTeam;
      const myScore = ownsHome ? m.homeScore : m.awayScore;
      const oppScore = ownsHome ? m.awayScore : m.homeScore;
      const raw = typed.find((r) => r.homeTeam === m.homeTeam && r.awayTeam === m.awayTeam && r.stage === m.stage);
      return {
        stage: m.stage, oppCode,
        myScore: myScore ?? 0, oppScore: oppScore ?? 0,
        earnedCents: matchEarningsCents(m, ownsHome, !ownsHome, rules),
        isWin: (myScore ?? 0) > (oppScore ?? 0),
        isDraw: (myScore ?? 0) === (oppScore ?? 0),
        matchDate: raw?.matchDate ?? null,
        venue: raw?.venue ?? null,
      };
    });

    return { teamCode: pick.teamCode, earnedCents, matchBreakdown };
  });

  const completedList = completedTournaments as { id: string; name: string; year: number }[];

  const pastPicksByTournament = completedList.length > 0
    ? await prisma.lineupPick.findMany({
        where: { userId, tournamentId: { in: completedList.map((t) => t.id) } },
        select: { tournamentId: true, teamCode: true },
      })
    : [];

  const history = completedList.map((t) => ({
    id: t.id, name: t.name, year: t.year,
    teamCodes: (pastPicksByTournament as { tournamentId: string; teamCode: string }[])
      .filter((p) => p.tournamentId === t.id)
      .map((p) => p.teamCode),
  }));

  return (
    <ProfileContent
      upcomingTournament={upcomingTournament}
      activeTournamentName={tournament ? `${tournament.name} ${tournament.year}` : null}
      totalEarnedCents={totalEarned}
      teams={teams}
      history={history}
      userName={userName}
      upcomingTeamName={upcomingTeamName}
      upcomingTournamentId={upcomingTournament?.id ?? null}
    />
  );
}
