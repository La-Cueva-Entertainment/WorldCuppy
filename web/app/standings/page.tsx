import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import TournamentView, { type TvPlayer, type TvMatch } from "@/components/TournamentView";
import TeamsExplorer, { type TeamsExplorerTeam } from "@/components/TeamsExplorer";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { totalEarningsCents, matchEarningsCents, resolvePayoutRules, type MatchResult } from "@/lib/earnings";
import { buildDraftTiers } from "@/lib/draftTiers";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

// Build tier lookup from default tier structure
function buildTierMap(tournamentId: string): Map<string, { num: number; label: string }> {
  const tiers = buildDraftTiers(tournamentId);
  const m = new Map<string, { num: number; label: string }>();
  for (const t of tiers) {
    for (const team of t.teams) {
      m.set(team.code, { num: t.num, label: t.labelBase });
    }
  }
  return m;
}

// Determine which stage a team has reached (highest stage they played)
const STAGE_ORDER_RANK: Record<string, number> = {
  group: 1, r32: 2, r16: 3, qf: 4, sf: 5, "3rd": 6, final: 7,
};

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

  // ── Build Teams Explorer data ──────────────────────────────────────
  const tierMap = buildTierMap(tournament.id);

  // Compute per-team stats from played matches
  const teamStats = new Map<string, {
    earningsCents: number;
    jumpBonusCount: number;
    highestStage: string | null;
    active: boolean;
    matchesPlayed: number;
    wins: number;
    draws: number;
    goalsFor: number;
  }>();

  // Initialize all known teams
  for (const team of TEAMS) {
    teamStats.set(team.code, { earningsCents: 0, jumpBonusCount: 0, highestStage: null, active: true, matchesPlayed: 0, wins: 0, draws: 0, goalsFor: 0 });
  }

  // For each played match, compute per-team stats
  for (const m of playedMatches) {
    const homeScore = m.homeScore ?? 0;
    const awayScore = m.awayScore ?? 0;
    const homeWon = homeScore > awayScore || m.penaltyWinner === m.homeTeam;
    const awayWon = awayScore > homeScore || m.penaltyWinner === m.awayTeam;
    const draw = !homeWon && !awayWon;

    const mr: MatchResult = {
      stage: m.stage as MatchResult["stage"],
      tournamentType: tournament.type as MatchResult["tournamentType"],
      homeTeam: m.homeTeam, awayTeam: m.awayTeam,
      homeScore, awayScore, penaltyWinner: m.penaltyWinner ?? null,
    };

    for (const [code, isHome] of [[m.homeTeam, true], [m.awayTeam, false]] as [string, boolean][]) {
      const s = teamStats.get(code) ?? { earningsCents: 0, jumpBonusCount: 0, highestStage: null, active: true, matchesPlayed: 0, wins: 0, draws: 0, goalsFor: 0 };
      s.matchesPlayed++;
      s.goalsFor += isHome ? homeScore : awayScore;
      if (isHome ? homeWon : awayWon) s.wins++;
      else if (draw) s.draws++;

      // Track highest stage reached
      const stageRank = STAGE_ORDER_RANK[m.stage] ?? 0;
      const curRank = STAGE_ORDER_RANK[s.highestStage ?? ""] ?? 0;
      if (stageRank > curRank) s.highestStage = m.stage;

      // Jump bonus: only group stage, winner must be in higher-numbered tier
      if (m.stage === "group" && (isHome ? homeWon : awayWon)) {
        const winnerTier = tierMap.get(code)?.num ?? 4;
        const loserCode = isHome ? m.awayTeam : m.homeTeam;
        const loserTier = tierMap.get(loserCode)?.num ?? 1;
        if (winnerTier > loserTier) s.jumpBonusCount++;
      }

      // Individual team earnings (owned by anyone — just need to know the team's total)
      s.earningsCents += matchEarningsCents(mr, isHome, !isHome, payoutRules);

      teamStats.set(code, s);
    }

    // Mark eliminated teams in knockout stages (loser is out)
    if (m.stage !== "group") {
      const loserCode = homeWon ? m.awayTeam : m.homeTeam;
      const ls = teamStats.get(loserCode);
      if (ls) { ls.active = false; teamStats.set(loserCode, ls); }
    }
  }

  // Mark all teams that haven't appeared in group stage as "active = true" (haven't started yet)
  // (they stay at their initial active=true default)

  // Build owner lookup (first owner per team)
  const ownerByTeam = new Map<string, { userId: string; name: string; colorIdx: number }>();
  for (const p of picks) {
    if (!ownerByTeam.has(p.teamCode)) {
      const idx = playerIds.indexOf(p.userId);
      ownerByTeam.set(p.teamCode, {
        userId: p.userId,
        name: displayName(p.userId),
        colorIdx: idx >= 0 ? idx % 8 : 0,
      });
    }
  }

  const explorerTeams: TeamsExplorerTeam[] = TEAMS.map((team) => {
    const stats = teamStats.get(team.code) ?? { earningsCents: 0, jumpBonusCount: 0, highestStage: null, active: true, matchesPlayed: 0, wins: 0, draws: 0, goalsFor: 0 };
    const tier = tierMap.get(team.code);
    const owner = ownerByTeam.get(team.code);
    return {
      code: team.code,
      name: team.name,
      rank: team.rank,
      group: team.group,
      tier: tier?.num ?? 4,
      tierLabel: tier?.label ?? "Long shots",
      ownerName: owner?.name ?? null,
      ownerUserId: owner?.userId ?? null,
      ownerColorIdx: owner?.colorIdx ?? null,
      earningsCents: stats.earningsCents,
      jumpBonusCount: stats.jumpBonusCount,
      highestStage: stats.highestStage,
      active: stats.active,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      draws: stats.draws,
      goalsFor: stats.goalsFor,
    };
  });

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
      extraContent={<TeamsExplorer teams={explorerTeams} />}
    />
  );
}

