import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import {
  matchEarningsCents,
  resolvePayoutRules,
  formatDollars,
  type MatchResult,
} from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter Finals",
  sf: "Semi Finals",
  "3rd": "3rd Place",
  final: "Final",
};

function fmtDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

export default async function MatchDetailPage({
  params,
}: {
  params: { matchId: string } | Promise<{ matchId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { matchId } = await Promise.resolve(params);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      stage: true,
      groupName: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
      penaltyWinner: true,
      played: true,
      live: true,
      matchDate: true,
      venue: true,
      tournamentId: true,
    },
  });

  if (!match) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { id: match.tournamentId },
    select: { id: true, name: true, year: true, type: true, payoutRules: true },
  });

  const [picks, users, participants] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: match.tournamentId },
      select: { userId: true, teamCode: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: match.tournamentId },
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
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of picks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  const payoutRules = resolvePayoutRules(
    tournament?.payoutRules as Record<string, number> | null
  );

  const homeTeamData = TEAMS_BY_CODE.get(match.homeTeam);
  const awayTeamData = TEAMS_BY_CODE.get(match.awayTeam);
  const homeWon =
    match.played &&
    ((match.homeScore ?? 0) > (match.awayScore ?? 0) ||
      match.penaltyWinner === match.homeTeam);
  const awayWon =
    match.played &&
    ((match.awayScore ?? 0) > (match.homeScore ?? 0) ||
      match.penaltyWinner === match.awayTeam);
  const showScore = match.played || match.live || (match.homeScore !== null && match.awayScore !== null);

  const mr: MatchResult = {
    stage: match.stage as MatchResult["stage"],
    tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    penaltyWinner: match.penaltyWinner ?? null,
  };

  // Per-player stakes
  const stakes = playerIds.flatMap((uid) => {
    const teams = teamsByPlayer.get(uid) ?? new Set<string>();
    const homeOwns = teams.has(match.homeTeam);
    const awayOwns = teams.has(match.awayTeam);
    if (!homeOwns && !awayOwns) return [];

    let earned = 0;
    let potential = 0;

    if (match.played || match.live) {
      // Played or live: show actual earnings from current score
      earned = matchEarningsCents(mr, homeOwns, awayOwns, payoutRules);
    } else {
      // Upcoming: show potential if-win
      const homeWinResult = { ...mr, homeScore: 1, awayScore: 0 };
      const awayWinResult = { ...mr, homeScore: 0, awayScore: 1 };
      const homeCents = homeOwns
        ? matchEarningsCents(homeWinResult, true, false, payoutRules)
        : 0;
      const awayCents = awayOwns
        ? matchEarningsCents(awayWinResult, false, true, payoutRules)
        : 0;
      potential = Math.max(homeCents, awayCents);
    }

    const colorIdx = playerIds.indexOf(uid) % 8;
    return [{ uid, name: displayName(uid), colorIdx, homeOwns, awayOwns, earned, potential }];
  });

  const kickoffStr = fmtDateTime(match.matchDate?.toISOString());

  return (
    <main className="page">
      <div className="wrap" style={{ maxWidth: 700 }}>
        {/* Back link */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/" className="tag-soft" style={{ fontWeight: 700, fontSize: 13 }}>
            ← Home
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="kicker">
            {STAGE_LABELS[match.stage] ?? match.stage}
            {match.groupName ? ` · Group ${match.groupName}` : ""}
            {tournament ? ` · ${tournament.name} ${tournament.year}` : ""}
          </div>
          <h1 style={{ marginTop: 6, fontSize: "clamp(22px,4vw,30px)" }}>
            {homeTeamData?.name ?? match.homeTeam} vs {awayTeamData?.name ?? match.awayTeam}
          </h1>
        </div>

        {/* Match result card */}
        <section className="card" style={{ padding: "24px", marginBottom: 20 }}>
          {/* Status row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            {match.played ? (
              <span className="badge grass">Final</span>
            ) : match.live ? (
              <span className="badge hot"><span className="live-dot" style={{ marginRight: 5 }}></span>Live now</span>
            ) : (
              <span className="tag-soft" style={{ fontWeight: 700 }}>
                {kickoffStr ?? "Kickoff TBD"}
              </span>
            )}
            {!match.played && kickoffStr && (
              <span className="badge" style={{ fontSize: 11 }}>Upcoming</span>
            )}
          </div>

          {/* Teams + score */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "16px", alignItems: "center" }}>
            {/* Home */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: match.played && !homeWon ? 0.5 : 1 }}>
              <div style={{ width: 64, height: 44, overflow: "hidden", borderRadius: 6, flexShrink: 0 }}>
                <CountryFlag code={match.homeTeam} label={homeTeamData?.name ?? match.homeTeam} className="fi-rect flag-xl" />
              </div>
              <div style={{ fontWeight: 800, fontSize: "clamp(15px,2.5vw,18px)", textAlign: "center" }}>
                {homeTeamData?.name ?? match.homeTeam}
              </div>
              {homeTeamData && (
                <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}>
                  FIFA #{homeTeamData.rank} · Group {homeTeamData.group}
                </div>
              )}
            </div>

            {/* Score */}
            <div style={{ textAlign: "center" }}>
              {showScore ? (
                <div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: "clamp(36px,6vw,52px)", letterSpacing: "-.02em", color: match.live ? "var(--hot)" : "inherit" }}>
                    {match.homeScore ?? 0}<span style={{ color: "var(--ink-faint)", margin: "0 4px" }}>–</span>{match.awayScore ?? 0}
                  </div>
                  {match.live && (
                    <div style={{ fontSize: 11, color: "var(--hot)", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <span className="live-dot"></span> In progress
                    </div>
                  )}
                  {match.penaltyWinner && (
                    <div style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 700, marginTop: 4 }}>
                      ({match.penaltyWinner === match.homeTeam
                        ? (homeTeamData?.name ?? match.homeTeam)
                        : (awayTeamData?.name ?? match.awayTeam)} win on pens)
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-faint)" }}>vs</div>
              )}
            </div>

            {/* Away */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: match.played && !awayWon ? 0.5 : 1 }}>
              <div style={{ width: 64, height: 44, overflow: "hidden", borderRadius: 6, flexShrink: 0 }}>
                <CountryFlag code={match.awayTeam} label={awayTeamData?.name ?? match.awayTeam} className="fi-rect flag-xl" />
              </div>
              <div style={{ fontWeight: 800, fontSize: "clamp(15px,2.5vw,18px)", textAlign: "center" }}>
                {awayTeamData?.name ?? match.awayTeam}
              </div>
              {awayTeamData && (
                <div style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}>
                  FIFA #{awayTeamData.rank} · Group {awayTeamData.group}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Match info */}
        <section className="card card-pad" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>Match info</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {kickoffStr && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-faint)", width: 80, flexShrink: 0 }}>Kickoff</span>
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{kickoffStr}</span>
              </div>
            )}
            {match.venue && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-faint)", width: 80, flexShrink: 0 }}>Venue</span>
                <span style={{ fontSize: 14, color: "var(--ink)" }}>{match.venue}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-faint)", width: 80, flexShrink: 0 }}>Stage</span>
              <span style={{ fontSize: 14, color: "var(--ink)" }}>
                {STAGE_LABELS[match.stage] ?? match.stage}
                {match.groupName ? ` · Group ${match.groupName}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-faint)", width: 80, flexShrink: 0 }}>Status</span>
              <span style={{ fontSize: 14, color: "var(--ink)" }}>
                {match.played ? "Final" : match.live ? "In progress" : "Upcoming"}
              </span>
            </div>
          </div>
        </section>

        {/* Player stakes */}
        {stakes.length > 0 && (
          <section className="card card-pad" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 14 }}>
              {match.played ? "Earnings" : "Stakes — potential if win"}
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {stakes.map((s) => (
                <div key={s.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)" }}>
                  <span className={`mdot m${s.colorIdx}`} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}>
                      Owns:{" "}
                      {[
                        s.homeOwns && (homeTeamData?.name ?? match.homeTeam),
                        s.awayOwns && (awayTeamData?.name ?? match.awayTeam),
                      ]
                        .filter(Boolean)
                        .join(" & ")}
                    </div>
                  </div>
                  <div className="money pos" style={{ fontSize: 16, fontWeight: 800 }}>
                    {(match.played || match.live)
                      ? s.earned > 0 ? `+${formatDollars(s.earned)}` : "—"
                      : s.potential > 0 ? `+${formatDollars(s.potential)}` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Payout explanation for upcoming match */}
        {!match.played && !match.live && (
          <section className="card card-pad" style={{ marginBottom: 20, background: "var(--surface-2)" }}>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
              <strong>How earnings work:</strong> Stakes shown are the base win earnings for this stage. Actual earnings also include goal difference bonuses
              {match.stage === "group" ? " and tier upset bonuses" : ""}.
              See <Link href="/standings" style={{ color: "var(--grass-deep)", textDecoration: "underline" }}>Standings</Link> for the full payout rules.
            </div>
          </section>
        )}

        {/* Back */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <Link href="/" className="btn btn-ghost">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
