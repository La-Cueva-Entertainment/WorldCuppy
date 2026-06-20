import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import TeamsExplorer, { type TeamsExplorerTeam } from "@/components/TeamsExplorer";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, resolvePayoutRules, type MatchResult } from "@/lib/earnings";
import { buildDraftTiers } from "@/lib/draftTiers";

const STAGE_ORDER_RANK: Record<string, number> = {
  group: 1, r32: 2, r16: 3, qf: 4, sf: 5, "3rd": 6, final: 7,
};

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, type: true, status: true, payoutRules: true },
  });

  if (!tournament) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="kicker" style={{ marginBottom: 8 }}>Teams</div>
          <h1 style={{ marginBottom: 16 }}>Teams</h1>
          <div className="card card-pad">
            <p style={{ color: "var(--ink-soft)" }}>No active tournament — team data will appear here once a tournament is underway.</p>
          </div>
        </div>
      </main>
    );
  }

  const [picks, playedMatches, users, participants] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamCode: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamName: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamNameById = new Map(
    participants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!])
  );
  function displayName(uid: string): string {
    const raw = teamNameById.get(uid);
    if (raw) return raw.length > 22 ? raw.slice(0, 22).trimEnd() + "…" : raw;
    const u = userById.get(uid);
    return u?.name ?? u?.email?.split("@")[0] ?? "?";
  }

  const playerIds = [...new Set(picks.map((p) => p.userId))].sort();
  const payoutRules = resolvePayoutRules(tournament.payoutRules as Record<string, number> | null);

  // Build tier lookup
  const tiers = buildDraftTiers(tournament.id);
  const tierMap = new Map<string, { num: number; label: string }>();
  for (const t of tiers) {
    for (const team of t.teams) {
      tierMap.set(team.code, { num: t.num, label: t.labelBase });
    }
  }

  // Per-team stats from played matches
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
  for (const team of TEAMS) {
    teamStats.set(team.code, {
      earningsCents: 0, jumpBonusCount: 0, highestStage: null,
      active: true, matchesPlayed: 0, wins: 0, draws: 0, goalsFor: 0,
    });
  }

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

      const stageRank = STAGE_ORDER_RANK[m.stage] ?? 0;
      const curRank = STAGE_ORDER_RANK[s.highestStage ?? ""] ?? 0;
      if (stageRank > curRank) s.highestStage = m.stage;

      // Jump bonus: group stage, winner in higher-numbered tier beats lower-numbered tier
      if (m.stage === "group" && (isHome ? homeWon : awayWon)) {
        const winnerTier = tierMap.get(code)?.num ?? 4;
        const loserCode = isHome ? m.awayTeam : m.homeTeam;
        const loserTier = tierMap.get(loserCode)?.num ?? 1;
        if (winnerTier > loserTier) s.jumpBonusCount++;
      }

      s.earningsCents += matchEarningsCents(mr, isHome, !isHome, payoutRules);
      teamStats.set(code, s);
    }

    // Mark knockout losers as eliminated
    if (m.stage !== "group") {
      const loserCode = homeWon ? m.awayTeam : m.homeTeam;
      const ls = teamStats.get(loserCode);
      if (ls) { ls.active = false; teamStats.set(loserCode, ls); }
    }
  }

  // Build owner lookup
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
    const stats = teamStats.get(team.code) ?? {
      earningsCents: 0, jumpBonusCount: 0, highestStage: null,
      active: true, matchesPlayed: 0, wins: 0, draws: 0, goalsFor: 0,
    };
    const tier = tierMap.get(team.code);
    const owner = ownerByTeam.get(team.code);
    return {
      code: team.code, name: team.name, rank: team.rank, group: team.group,
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

  const activeCount = explorerTeams.filter((t) => t.active && t.matchesPlayed > 0).length;
  const jumpCount = explorerTeams.filter((t) => t.jumpBonusCount > 0).length;

  return (
    <main className="page">
      <div className="wrap">
        {/* Header */}
        <div className="between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <div>
            <div className="kicker grass">
              {tournament.status === "active" ? "Live" : tournament.status === "complete" ? "Complete" : tournament.status}
            </div>
            <h1 style={{ marginTop: 4 }}>Teams — {tournament.name} {tournament.year}</h1>
          </div>
        </div>

        {/* Quick stat row */}
        <div className="stats4" style={{ marginBottom: 24 }}>
          <div className="card st">
            <div className="k">Total teams</div>
            <div className="v">{explorerTeams.length}</div>
          </div>
          <div className="card st">
            <div className="k">Still active</div>
            <div className="v">{activeCount > 0 ? activeCount : "—"}</div>
          </div>
          <div className="card st">
            <div className="k">Jump bonuses</div>
            <div className="v">{jumpCount > 0 ? jumpCount : "—"}</div>
          </div>
          <div className="card st">
            <div className="k">Matches played</div>
            <div className="v">{playedMatches.length}</div>
          </div>
        </div>

        {/* Teams Explorer */}
        <TeamsExplorer teams={explorerTeams} />
      </div>
    </main>
  );
}
