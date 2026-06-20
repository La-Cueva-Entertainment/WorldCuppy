import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import {
  matchEarningsCents,
  totalEarningsCents,
  resolvePayoutRules,
  formatDollars,
  type MatchResult,
} from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd", final: "Final",
};

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
  });
}

export default async function PlayerDetailPage({
  params,
}: {
  params: { userId: string } | Promise<{ userId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { userId: targetUserId } = await Promise.resolve(params);

  // Verify user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true },
  });
  if (!targetUser) notFound();

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, type: true, payoutRules: true },
  });

  const participant = tournament
    ? await prisma.tournamentParticipant.findFirst({
        where: { tournamentId: tournament.id, userId: targetUserId },
        select: { teamName: true },
      })
    : null;

  const teamName = participant?.teamName ?? null;
  const displayName =
    teamName ?? targetUser.name ?? targetUser.email?.split("@")[0] ?? "?";

  const [myPicks, rawMatches, allParticipants, allUsers, allPicks] = tournament
    ? await Promise.all([
        prisma.lineupPick.findMany({
          where: { tournamentId: tournament.id, userId: targetUserId },
          orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
          select: { teamCode: true, pickNumber: true },
        }),
        prisma.match.findMany({
          where: { tournamentId: tournament.id, played: true },
          select: {
            id: true,
            stage: true,
            homeTeam: true,
            awayTeam: true,
            homeScore: true,
            awayScore: true,
            penaltyWinner: true,
            matchDate: true,
            venue: true,
          },
        }),
        prisma.tournamentParticipant.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, teamName: true },
        }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        prisma.lineupPick.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, teamCode: true },
        }),
      ])
    : [[], [], [], [], []];

  const payoutRules = resolvePayoutRules(
    tournament?.payoutRules as Record<string, number> | null
  );

  type RawMatch = (typeof rawMatches)[0];

  const matchResults: MatchResult[] = rawMatches.map((m: RawMatch) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const myTeamCodes = new Set(myPicks.map((p) => p.teamCode));
  const totalEarned = totalEarningsCents(matchResults, myTeamCodes, payoutRules);

  // Build standings for rank
  const teamNameById = new Map(
    allParticipants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!])
  );
  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const playerIds = [...new Set(allPicks.map((p) => p.userId))].sort();
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of allPicks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }
  const standings = playerIds
    .map((uid) => ({
      uid,
      cents: totalEarningsCents(matchResults, teamsByPlayer.get(uid) ?? new Set(), payoutRules),
    }))
    .sort((a, b) => b.cents - a.cents);
  const rank = standings.findIndex((s) => s.uid === targetUserId) + 1;
  const colorIdx = playerIds.indexOf(targetUserId) % 8;

  // Per-team breakdown
  const teams = myPicks.map((pick) => {
    const teamMatches = matchResults.filter(
      (m) => m.homeTeam === pick.teamCode || m.awayTeam === pick.teamCode
    );
    const earnedCents = totalEarningsCents(teamMatches, new Set([pick.teamCode]), payoutRules);
    const matchBreakdown = teamMatches.map((m) => {
      const ownsHome = m.homeTeam === pick.teamCode;
      const oppCode = ownsHome ? m.awayTeam : m.homeTeam;
      const myScore = ownsHome ? m.homeScore : m.awayScore;
      const oppScore = ownsHome ? m.awayScore : m.homeScore;
      const raw = rawMatches.find(
        (r: RawMatch) =>
          r.homeTeam === m.homeTeam && r.awayTeam === m.awayTeam && r.stage === m.stage
      );
      return {
        stage: m.stage,
        oppCode,
        myScore: myScore ?? 0,
        oppScore: oppScore ?? 0,
        earnedCents: matchEarningsCents(m, ownsHome, !ownsHome, payoutRules),
        isWin: (myScore ?? 0) > (oppScore ?? 0),
        isDraw: (myScore ?? 0) === (oppScore ?? 0),
        matchDate: raw?.matchDate ?? null,
        matchId: raw?.id ?? null,
      };
    });
    return { teamCode: pick.teamCode, earnedCents, matchBreakdown };
  });

  const isYou = session.user.id === targetUserId;

  return (
    <main className="page">
      <div className="wrap">
        {/* Back */}
        <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
          <Link href="/standings" className="tag-soft" style={{ fontWeight: 700, fontSize: 13 }}>
            ← Standings
          </Link>
        </div>

        {/* Header */}
        <div className="prof-head" style={{ marginBottom: 24 }}>
          <div className="prof-av" style={{ background: `var(--m${colorIdx}-bg, var(--grass-soft))`, color: `var(--m${colorIdx}-fg, var(--grass-deep))` }}>
            {(displayName[0] ?? "?").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div className="kicker grass">
              {tournament ? `${tournament.name} ${tournament.year}` : "Manager"}
            </div>
            <h1 style={{ marginTop: 4, fontSize: "clamp(24px,4vw,32px)" }}>
              {displayName}
              {isYou && <span className="tag-soft" style={{ marginLeft: 10, fontSize: 14, fontWeight: 600 }}>you</span>}
            </h1>
            {teamName && (
              <div style={{ fontSize: 13, color: "var(--ink-faint)", marginTop: 2 }}>
                {targetUser.name ?? targetUser.email?.split("@")[0]}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="stats4" style={{ marginBottom: 24 }}>
          <div className="card st">
            <div className="k">Rank</div>
            <div className="v">{rank > 0 ? `#${rank}` : "—"}</div>
          </div>
          <div className="card st">
            <div className="k">Earned</div>
            <div className="v money pos">{formatDollars(totalEarned)}</div>
          </div>
          <div className="card st">
            <div className="k">Teams</div>
            <div className="v">{myTeamCodes.size || "—"}</div>
          </div>
          <div className="card st">
            <div className="k">Matches</div>
            <div className="v">{rawMatches.filter((m: RawMatch) => myTeamCodes.has(m.homeTeam) || myTeamCodes.has(m.awayTeam)).length || "—"}</div>
          </div>
        </div>

        {/* Teams */}
        {teams.length > 0 ? (
          <section style={{ display: "grid", gap: 16 }}>
            <div className="sec-head">
              <h2 style={{ fontSize: 19 }}>Teams</h2>
              <div className="money pos">{formatDollars(totalEarned)}</div>
            </div>
            {teams.map((team) => {
              const teamData = TEAMS_BY_CODE.get(team.teamCode);
              return (
                <div key={team.teamCode} className="card" style={{ overflow: "hidden" }}>
                  {/* Team header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                    <CountryFlag code={team.teamCode} label={teamData?.name ?? team.teamCode} className="flag-lg fi-rect" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{teamData?.name ?? team.teamCode}</div>
                      {teamData && (
                        <div className="tag-soft" style={{ marginTop: 2 }}>
                          FIFA #{teamData.rank} · Group {teamData.group}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="tag-soft">earned</div>
                      <div className={`money${team.earnedCents > 0 ? " pos" : ""}`} style={{ fontSize: 18 }}>
                        {formatDollars(team.earnedCents)}
                      </div>
                    </div>
                  </div>
                  {/* Match breakdown */}
                  {team.matchBreakdown.length > 0 ? (
                    team.matchBreakdown.map((match, i) => {
                      const opp = TEAMS_BY_CODE.get(match.oppCode);
                      return (
                        <Link
                          key={i}
                          href={match.matchId ? `/match/${match.matchId}` : "#"}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i < team.matchBreakdown.length - 1 ? "1px solid var(--line-soft)" : "none", textDecoration: "none", color: "inherit" }}
                        >
                          <span style={{ width: 40, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-faint)", flexShrink: 0 }}>
                            {STAGE_LABELS[match.stage] ?? match.stage}
                          </span>
                          <CountryFlag code={match.oppCode} label={opp?.name ?? match.oppCode} className="flag-sm fi-rect" />
                          <span style={{ flex: 1, fontSize: 13, color: "var(--ink-soft)" }}>
                            vs {opp?.name ?? match.oppCode}
                            {match.matchDate && (
                              <span style={{ marginLeft: 6, color: "var(--ink-faint)" }}>
                                {fmtDate(match.matchDate)}
                              </span>
                            )}
                          </span>
                          <span className={`finish${match.isWin ? " pod" : " mid"}`}>
                            {match.myScore}–{match.oppScore}
                          </span>
                          <span className={`money${match.earnedCents > 0 ? " pos" : ""}`} style={{ fontSize: 13, minWidth: 52, textAlign: "right" }}>
                            {match.earnedCents > 0 ? `+${formatDollars(match.earnedCents)}` : "—"}
                          </span>
                        </Link>
                      );
                    })
                  ) : (
                    <div style={{ padding: "10px 16px", fontSize: 13, color: "var(--ink-faint)" }}>No matches played yet</div>
                  )}
                </div>
              );
            })}
          </section>
        ) : (
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <p className="muted">No teams drafted yet for the active tournament.</p>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
          <Link href="/standings" className="btn btn-ghost">← Back to standings</Link>
          {isYou && <Link href="/profile" className="btn btn-primary btn-sm">Edit profile →</Link>}
        </div>
      </div>
    </main>
  );
}
