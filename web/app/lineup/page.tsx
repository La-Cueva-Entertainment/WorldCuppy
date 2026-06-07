import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { matchEarningsCents, resolvePayoutRules, formatDollars, type MatchResult } from "@/lib/earnings";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const _sorted = TEAMS.slice().sort((a, b) => a.rank - b.rank);
const _chunk = Math.ceil(_sorted.length / 4);
const TIER_LABELS = ["Contenders", "Dark horses", "Mid pack", "Long shots"] as const;
const TEAM_TIER_LABEL = new Map<string, string>(
  _sorted.map((t, i) => [t.code, TIER_LABELS[Math.min(Math.floor(i / _chunk), 3)]!])
);
const TEAM_TIER_NUM = new Map<string, number>(
  _sorted.map((t, i) => [t.code, Math.floor(i / _chunk) + 1])
);

export default async function LineupPage() {
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
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, payoutRules: true },
  });

  if (!tournament) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="kicker">My Teams</div>
          <h1>No active tournament</h1>
          <p className="muted">Your picks will appear here once a tournament is underway.</p>
        </div>
      </main>
    );
  }

  const [myPicks, playedMatches, allPicks, allUsers, upcomingMatches, myAdjustments] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id, userId },
      select: { teamCode: true, pickNumber: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      orderBy: [{ matchDate: "asc" }],
      select: { homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, matchDate: true },
    }),
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamCode: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: false },
      orderBy: [{ matchDate: "asc" }],
      select: { homeTeam: true, awayTeam: true, matchDate: true },
    }),
    prisma.earningsAdjustment.findMany({
      where: { tournamentId: tournament.id, userId },
      select: { amountCents: true },
    }),
  ]);

  const payoutRules = resolvePayoutRules(tournament.payoutRules as Record<string, number> | null);
  const matchResults: MatchResult[] = playedMatches.map((m) => ({
    stage: "group" as const,
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const myCodes = new Set(myPicks.map((p) => p.teamCode));
  const teamEarnings = new Map<string, number>();
  for (const code of myCodes) {
    let cents = 0;
    for (const m of playedMatches) {
      const mr: MatchResult = {
        stage: "group" as const,
        tournamentType: tournament.type as MatchResult["tournamentType"],
        homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
        penaltyWinner: m.penaltyWinner ?? null,
      };
      cents += matchEarningsCents(mr, m.homeTeam === code, m.awayTeam === code, payoutRules);
    }
    teamEarnings.set(code, cents);
  }

  const adjustTotal = myAdjustments.reduce((s, a) => s + a.amountCents, 0);
  const totalEarnings = [...teamEarnings.values()].reduce((s, v) => s + v, 0) + adjustTotal;

  // Pool position
  const playerIds = [...new Set(allPicks.map((p) => p.userId))];
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of allPicks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }
  const allAdjustments = await prisma.earningsAdjustment.findMany({
    where: { tournamentId: tournament.id },
    select: { userId: true, amountCents: true },
  });
  const adjByUser = new Map<string, number>();
  for (const a of allAdjustments) adjByUser.set(a.userId, (adjByUser.get(a.userId) ?? 0) + a.amountCents);

  const ranked = playerIds
    .map((uid) => {
      let e = 0;
      const codes = teamsByPlayer.get(uid) ?? new Set<string>();
      for (const m of playedMatches) {
        for (const code of codes) {
          const mr: MatchResult = {
            stage: "group" as const,
            tournamentType: tournament.type as MatchResult["tournamentType"],
            homeTeam: m.homeTeam, awayTeam: m.awayTeam,
            homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
            penaltyWinner: m.penaltyWinner ?? null,
          };
          e += matchEarningsCents(mr, m.homeTeam === code, m.awayTeam === code, payoutRules);
        }
      }
      e += adjByUser.get(uid) ?? 0;
      return { uid, earnings: e };
    })
    .sort((a, b) => b.earnings - a.earnings);

  const poolPosition = ranked.findIndex((r) => r.uid === userId) + 1;

  function getForm(code: string): Array<"W" | "D" | "L"> {
    return playedMatches
      .filter((m) => m.homeTeam === code || m.awayTeam === code)
      .slice(-5)
      .map((m) => {
        const hs = m.homeScore ?? 0;
        const as_ = m.awayScore ?? 0;
        if (m.penaltyWinner) return m.penaltyWinner === code ? "W" : "L";
        if (hs === as_) return "D";
        return (m.homeTeam === code ? hs > as_ : as_ > hs) ? "W" : "L";
      });
  }

  function nextMatch(code: string) {
    return upcomingMatches.find((m) => m.homeTeam === code || m.awayTeam === code) ?? null;
  }

  const teamCards = myPicks
    .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0))
    .map((p) => ({
      ...p,
      team: TEAMS_BY_CODE.get(p.teamCode),
      form: getForm(p.teamCode),
      earned: teamEarnings.get(p.teamCode) ?? 0,
      next: nextMatch(p.teamCode),
    }));

  const remainingSlots = Math.max(0, tournament.teamsPerPlayer - myPicks.length);

  return (
    <main className="page">
      <div className="wrap">

        <div className="between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          <div>
            <div className="kicker">{session.user.name ?? "You"} · {tournament.name} {tournament.year}</div>
            <h1>My Teams</h1>
          </div>
          {tournament.status === "draft" && (
            <Link href="/draft" className="btn">Go to draft →</Link>
          )}
        </div>

        {/* Summary stats */}
        <div className="card summary" style={{ marginBottom: 24 }}>
          <div className="stat">
            <div className="k">Total earned</div>
            <div className="v">{formatDollars(totalEarnings)}</div>
          </div>
          <div className="stat">
            <div className="k">Pool position</div>
            <div className="v">{poolPosition > 0 ? `#${poolPosition}` : "—"}</div>
          </div>
          <div className="stat">
            <div className="k">Teams drafted</div>
            <div className="v">{myPicks.length}/{tournament.teamsPerPlayer}</div>
          </div>
        </div>

        {/* Team cards */}
        <div className="teams-col stack-12">
          {teamCards.map(({ teamCode, team, form, earned, next }) => {
            const tierNum = TEAM_TIER_NUM.get(teamCode) ?? 1;
            const tierLabel = TEAM_TIER_LABEL.get(teamCode) ?? "Contenders";
            const oppCode = next ? (next.homeTeam === teamCode ? next.awayTeam : next.homeTeam) : null;
            const oppTeam = oppCode ? TEAMS_BY_CODE.get(oppCode) : null;
            return (
              <div key={teamCode} className="card tcard">
                <CountryFlag code={teamCode} label={team?.name ?? teamCode} className="flag-xl fi-rect" />
                <div>
                  <div className="nm">{team?.name ?? teamCode.toUpperCase()}</div>
                  <div className="sub" style={{ marginTop: 4 }}>
                    <span className={`tier tier-${tierNum}`}>{tierLabel}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink-faint)" }}>FIFA #{team?.rank}</span>
                  </div>
                  {form.length > 0 && (
                    <div className="form">
                      {form.map((r, i) => (
                        <span key={i} className={r === "W" ? "w" : r === "D" ? "d" : "l"}>{r}</span>
                      ))}
                    </div>
                  )}
                  {next && (
                    <div className="sub" style={{ marginTop: 5 }}>
                      Next: {next.homeTeam === teamCode ? "vs" : "@"} {oppTeam?.name ?? oppCode}
                      {next.matchDate && <> · {new Date(next.matchDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
                    </div>
                  )}
                </div>
                <div className="earnbox">
                  <div className="elbl">Earned</div>
                  <div className="amt">{formatDollars(earned)}</div>
                </div>
              </div>
            );
          })}

          {Array.from({ length: remainingSlots }).map((_, i) => (
            <div key={`empty-${i}`} className="slot-empty">
              <span className="sbadge">Pick {myPicks.length + i + 1}</span>
              <Link href="/draft" className="scta">
                {tournament.status === "draft" ? "Head to the draft →" : "Draft not open yet"}
              </Link>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
