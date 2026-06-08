import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import TournamentView, { type TvPlayer, type TvMatch } from "@/components/TournamentView";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { totalEarningsCents, resolvePayoutRules, type MatchResult } from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export default async function StandingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const userId = session.user.id ?? null;

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, payoutRules: true },
  });

  if (!tournament) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="between" style={{ flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
            <div>
              <h1 style={{ marginTop: 4 }}>Standings</h1>
            </div>
          </div>
          <div className="card" style={{ padding: "20px 24px" }}>
            <p style={{ color: "var(--ink-soft)" }}>No active tournament &mdash; standings and bracket will appear here once a tournament is underway.</p>
          </div>
        </div>
      </main>
    );
  }

  const [picks, playedMatches, users, adjustments, allDbMatches, participants] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamCode: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.earningsAdjustment.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, amountCents: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
    }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamName: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamNameById = new Map(participants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!]));
  function displayName(uid: string): string {
    const raw = teamNameById.has(uid) ? teamNameById.get(uid)! : null;
    if (raw) return raw.length > 22 ? raw.slice(0, 22).trimEnd() + "…" : raw;
    const u = userById.get(uid);
    return u?.name ?? u?.email?.split("@")[0] ?? "?";
  }
  const playerIds = [...new Set(picks.map((p) => p.userId))].sort();

  const teamOwners = new Map<string, string[]>();
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of picks) {
    const arr = teamOwners.get(p.teamCode) ?? [];
    arr.push(p.userId);
    teamOwners.set(p.teamCode, arr);
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  const payoutRules = resolvePayoutRules(tournament.payoutRules as Record<string, number> | null);

  const matchResults: MatchResult[] = playedMatches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const ranked = playerIds
    .map((uid, i) => ({ uid, colorIdx: i, earnings: totalEarningsCents(matchResults, teamsByPlayer.get(uid) ?? new Set(), payoutRules) + adjustments.filter((a) => a.userId === uid).reduce((s, a) => s + a.amountCents, 0) }))
    .sort((a, b) => b.earnings - a.earnings);

  function ownerInfo(teamCode: string) {
    const ids = teamOwners.get(teamCode) ?? [];
    return {
      names: ids.map((id) => displayName(id)),
      colorIdx: ids.length > 0 ? playerIds.indexOf(ids[0]) : null,
    };
  }

  type DbMatch = typeof allDbMatches[0];
  function convertMatch(dbm: DbMatch): TvMatch {
    const ho = ownerInfo(dbm.homeTeam);
    const ao = ownerInfo(dbm.awayTeam);
    return {
      id: dbm.id,
      stage: dbm.stage,
      groupName: dbm.groupName,
      homeTeam: dbm.homeTeam,
      homeTeamName: TEAMS_BY_CODE.get(dbm.homeTeam)?.name ?? dbm.homeTeam,
      awayTeam: dbm.awayTeam,
      awayTeamName: TEAMS_BY_CODE.get(dbm.awayTeam)?.name ?? dbm.awayTeam,
      homeScore: dbm.homeScore,
      awayScore: dbm.awayScore,
      penaltyWinner: dbm.penaltyWinner,
      played: dbm.played,
      matchDateISO: dbm.matchDate ? dbm.matchDate.toISOString() : null,
      venue: dbm.venue,
      homeOwnerNames: ho.names,
      homeOwnerColorIdx: ho.colorIdx,
      awayOwnerNames: ao.names,
      awayOwnerColorIdx: ao.colorIdx,
    };
  }

  const tvPlayers: TvPlayer[] = ranked.map((r) => {
    const user = userById.get(r.uid);
    const teams = [...(teamsByPlayer.get(r.uid) ?? [])].map((code) => ({
      code, name: TEAMS_BY_CODE.get(code)?.name ?? code,
    }));
    return { id: r.uid, name: displayName(r.uid), earnings: r.earnings, teams, colorIdx: r.colorIdx, isYou: r.uid === userId };
  });

  const tvMatchesByStage: Partial<Record<string, TvMatch[]>> = {};
  for (const dbm of allDbMatches) {
    const arr = tvMatchesByStage[dbm.stage] ?? [];
    arr.push(convertMatch(dbm));
    tvMatchesByStage[dbm.stage] = arr;
  }

  return (
    <TournamentView
      name={tournament.name}
      year={tournament.year}
      type={tournament.type}
      status={tournament.status}
      showTodayMatches={false}
      todayMatches={[]}
      players={tvPlayers}
      matchesByStage={tvMatchesByStage}
      payoutRules={payoutRules}
    />
  );
}
