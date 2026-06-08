import Link from "next/link";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { LiveSync } from "@/components/LiveSync";
import RssFeed from "@/components/RssFeed";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, totalEarningsCents, resolvePayoutRules, formatDollars, type MatchResult } from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage", r32: "Round of 32", r16: "Round of 16",
  qf: "Quarter Finals", sf: "Semi Finals", "3rd": "3rd Place", final: "Final",
};

/** Ordinal suffix for a rank number */
function ordinal(n: number) {
  const s = ["th","st","nd","rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { day?: string } | Promise<{ day?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="page">
        <div className="wrap">
          {/* ── Hero ── */}
          <section className="pitch-panel" style={{ borderRadius: "var(--r-xl)", padding: "clamp(32px,5vw,60px) clamp(20px,4vw,48px)", marginBottom: "32px" }}>
            <div style={{ maxWidth: "560px" }}>
              <span className="badge" style={{ marginBottom: "18px", background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}>
                <span className="live-dot" style={{ background: "#fff" }}></span>
                World Cup 2026
              </span>
              <h1 style={{ fontSize: "clamp(34px,6vw,58px)", color: "#fff", marginTop: "4px", lineHeight: 1.0 }}>
                Pick nations.<br />Win the <span style={{ color: "var(--gold)" }}>pool.</span>
              </h1>
              <p style={{ marginTop: "16px", fontSize: "16px", color: "rgba(255,255,255,.78)", lineHeight: 1.55, maxWidth: "440px" }}>
                Draft real national teams, track every match live, and compete with friends for real money.
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "28px", flexWrap: "wrap" }}>
                <Link href="/register" className="btn btn-gold">Create your account</Link>
                <Link href="/login" className="btn btn-ghost" style={{ background: "rgba(255,255,255,.12)", borderColor: "rgba(255,255,255,.2)", color: "#fff" }}>Sign in →</Link>
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "28px", flexWrap: "wrap" }}>
                {[["🌍", "All major tournaments"], ["🐍", "Fair snake draft"], ["📊", "Live earnings"]].map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Feature cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "32px" }}>
            {[
              { icon: "🏆", title: "Every tournament", desc: "World Cup, Euros, Nations League — all covered with live match data." },
              { icon: "🐍", title: "Fair snake draft", desc: "Pick national teams in a snake draft — everyone gets a fair shot at the best." },
              { icon: "💰", title: "Live earnings", desc: "Earn money for wins, goal differences, and knockout upsets. Settled in real time." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card card-pad">
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>{icon}</div>
                <h3 style={{ fontSize: "16px", marginBottom: "6px" }}>{title}</h3>
                <p style={{ fontSize: "14px", color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* ── How it works ── */}
          <div className="card card-pad" style={{ textAlign: "center" }}>
            <div className="kicker" style={{ marginBottom: "12px" }}>How it works</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "20px", marginTop: "16px" }}>
              {["Create an account", "Join a pool", "Snake draft your teams", "Earn money every match"].map((step, i) => (
                <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--grass-soft)", color: "var(--grass-deep)", fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 800, fontSize: "16px", display: "grid", placeItems: "center" }}>{i + 1}</div>
                  <p style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--ink)" }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Fetch tournament data ─────────────────────────────────────────
  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["upcoming", "draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, draftDate: true, payoutRules: true },
  });

  // ── Match day navigation ─────────────────────────────────────────
  const resolvedSP = searchParams ? await Promise.resolve(searchParams) : {};
  const requestedDay = (resolvedSP as { day?: string }).day ?? null;

  const nowPST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(nowPST);

  function pstDayStr(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(date);
  }
  function fmtDayLabel(dayStr: string): string {
    const [y, mo, d] = dayStr.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(y!, (mo ?? 1) - 1, d));
  }

  const [allTournamentMatches, allPicks, users, playedMatches, adjustments, participants] = tournament
    ? await Promise.all([
        prisma.match.findMany({
          where: { tournamentId: tournament.id, matchDate: { not: null } },
          orderBy: { matchDate: "asc" },
          select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
        }),
        prisma.lineupPick.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, teamCode: true },
        }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        prisma.match.findMany({
          where: { tournamentId: tournament.id, played: true },
          select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true },
        }),
        prisma.earningsAdjustment.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, amountCents: true },
        }),
        prisma.tournamentParticipant.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, teamName: true },
        }),
      ])
    : [[], [], [], [], [], []];

  // Build sorted unique day list from all match dates
  const allDays = [...new Set(
    allTournamentMatches
      .filter((m) => m.matchDate)
      .map((m) => pstDayStr(m.matchDate as Date))
  )].sort();

  // Default: first day >= today with at least one unplayed match; fall back to last known day
  const defaultDay =
    allDays.find((d) => {
      if (d < todayStr) return false;
      return allTournamentMatches.some((m) => m.matchDate && pstDayStr(m.matchDate as Date) === d && !m.played);
    }) ??
    allDays.find((d) => d >= todayStr) ??
    allDays[allDays.length - 1] ??
    todayStr;

  const selectedDay = requestedDay && allDays.includes(requestedDay) ? requestedDay : defaultDay;
  const selectedDayIdx = allDays.indexOf(selectedDay);
  const prevDay = selectedDayIdx > 0 ? (allDays[selectedDayIdx - 1] ?? null) : null;
  const nextDay = selectedDayIdx < allDays.length - 1 ? (allDays[selectedDayIdx + 1] ?? null) : null;

  const selectedDayMatches = allTournamentMatches.filter(
    (m) => m.matchDate && pstDayStr(m.matchDate as Date) === selectedDay
  );
  const selectedDayLabel = allDays.length > 0 ? fmtDayLabel(selectedDay) : null;

  const userById = new Map(users.map((u: { id: string; name: string | null; email: string | null }) => [u.id, u]));
  const teamNameById = new Map(
    (participants as { userId: string; teamName: string | null }[])
      .filter((p) => p.teamName)
      .map((p) => [p.userId, p.teamName!])
  );

  function shortRealName(uid: string): string | null {
    const u = userById.get(uid);
    const full = u?.name ?? u?.email?.split("@")[0];
    if (!full) return null;
    const parts = full.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }

  const playerIds = [...new Set(allPicks.map((p: { userId: string; teamCode: string }) => p.userId))].sort();
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of allPicks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  // ── Compute per-player standings ──────────────────────────────────
  const payoutRules = tournament ? resolvePayoutRules((tournament.payoutRules as Record<string, number> | null)) : null;
  const matchResults: MatchResult[] = playedMatches.map((m: { stage: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; penaltyWinner: string | null }) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const adjByUser = new Map<string, number>();
  for (const a of adjustments as { userId: string; amountCents: number }[]) {
    adjByUser.set(a.userId, (adjByUser.get(a.userId) ?? 0) + a.amountCents);
  }

  const standings = playerIds
    .map((uid: string) => {
      const teams = teamsByPlayer.get(uid) ?? new Set<string>();
      const cents = payoutRules
        ? totalEarningsCents(matchResults, teams, payoutRules) + (adjByUser.get(uid) ?? 0)
        : (adjByUser.get(uid) ?? 0);
      const u = userById.get(uid);
      const teamName = teamNameById.get(uid) ?? null;
      const displayName = teamName ?? u?.name ?? u?.email?.split("@")[0] ?? "?";
      const realSub = teamName ? shortRealName(uid) : null;
      return { uid, displayName, realSub, cents };
    })
    .sort((a, b) => b.cents - a.cents);

  const myIdx = standings.findIndex((s) => s.uid === userId);
  const myRank = myIdx + 1;
  const myEntry = standings[myIdx];
  const myTeams = userId ? [...(teamsByPlayer.get(userId) ?? new Set<string>())] : [];
  const leadCents = myIdx === 0 && standings.length > 1 ? (myEntry?.cents ?? 0) - (standings[1]?.cents ?? 0) : null;

  const showDraftCard = tournament && (tournament.status === "upcoming" || tournament.status === "draft");
  const showLiveSync = tournament?.status === "active";
  const isActive = tournament?.status === "active" || tournament?.status === "complete";

  // Manager color index (stable: sorted playerIds index)
  const colorOf = (uid: string) => playerIds.indexOf(uid) % 8;

  return (
    <main className="page">
      <div className="wrap">
        {/* Page header */}
        <div className="between" style={{ marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div className="kicker grass">{tournament?.status === "active" ? "Live" : tournament?.status === "draft" ? "Draft Open" : tournament?.status === "complete" ? "Complete" : "Coming Up"}</div>
            <h1 style={{ fontSize: "clamp(26px,4vw,34px)", marginTop: "4px" }}>
              {tournament ? `${tournament.name} ${tournament.year}` : "World Cuppy"}
            </h1>
          </div>
          {selectedDayMatches.length > 0 && (
            <span className="badge hot"><span className="live-dot"></span> {selectedDayMatches.length} match{selectedDayMatches.length !== 1 ? "es" : ""}{selectedDayLabel ? ` · ${selectedDayLabel}` : ""}</span>
          )}
          {showLiveSync && <LiveSync />}
        </div>

        {/* 2-col layout */}
        <div className="home-grid">
          {/* Left column */}
          <div style={{ display: "grid", gap: "26px", minWidth: 0 }}>

            {/* Draft countdown card */}
            {showDraftCard && tournament.draftDate && (
              <section className="card card-pad">
                <div className="between" style={{ marginBottom: "14px" }}>
                  <div>
                    <div className="kicker">{tournament.status === "draft" ? "Draft Open" : "Coming Up"}</div>
                    <h2 style={{ marginTop: "4px" }}>{tournament.name} {tournament.year}</h2>
                    <p className="muted" style={{ fontSize: "13px", marginTop: "4px" }}>{tournament.teamsPerPlayer} teams per player · snake draft</p>
                  </div>
                  <Link href="/draft" className="btn btn-primary btn-sm">Open Draft →</Link>
                </div>
                <CountdownTimer targetISO={tournament.draftDate.toISOString()} label={`${tournament.name} ${tournament.year} Draft`} />
              </section>
            )}

            {/* Hero: your position */}
            {isActive && myEntry && (
              <section className="pitch-panel" style={{ borderRadius: "var(--r-xl)", padding: "clamp(20px,3vw,30px)", display: "grid", gridTemplateColumns: "1fr auto", gap: "18px", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>Your position</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", marginTop: "6px" }}>
                    <div style={{ fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 900, fontSize: "clamp(54px,9vw,84px)", lineHeight: .82, letterSpacing: "-.04em", color: "#fff" }}>
                      {ordinal(myRank)}
                    </div>
                    <div style={{ paddingBottom: "10px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.7)", marginBottom: "2px" }}>Earnings</div>
                      <div className="money" style={{ fontFamily: "var(--font-spline), 'Spline Sans Mono', monospace", fontWeight: 700, fontSize: "clamp(26px,4vw,38px)", color: "var(--gold)" }}>
                        {formatDollars(myEntry.cents)}
                      </div>
                    </div>
                  </div>
                  {myTeams.length > 0 && (
                    <div style={{ display: "flex", gap: "7px", marginTop: "14px", flexWrap: "wrap" }}>
                      {myTeams.map((code) => (
                        <CountryFlag key={code} code={code} label={TEAMS_BY_CODE.get(code)?.name ?? code} className="fi-rect flag-xl" />
                      ))}
                    </div>
                  )}
                </div>
                {standings.length > 1 && (
                  <div className="hide-sm" style={{ textAlign: "right" }}>
                    {leadCents !== null && leadCents > 0 ? (
                      <>
                        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>Lead over 2nd</div>
                        <div className="money" style={{ fontFamily: "var(--font-spline), 'Spline Sans Mono', monospace", fontWeight: 700, fontSize: "24px", color: "#fff" }}>+{formatDollars(leadCents)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>Behind 1st</div>
                        <div className="money" style={{ fontFamily: "var(--font-spline), 'Spline Sans Mono', monospace", fontWeight: 700, fontSize: "24px", color: "#fff" }}>
                          {formatDollars((standings[0]?.cents ?? 0) - myEntry.cents)}
                        </div>
                      </>
                    )}
                    <Link href="/standings" className="btn btn-gold btn-sm" style={{ marginTop: "14px" }}>Full standings →</Link>
                  </div>
                )}
              </section>
            )}

            {/* No tournament */}
            {!tournament && (
              <section className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚽</div>
                <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>No tournament yet</h2>
                <p className="muted" style={{ fontSize: "14px" }}>A tournament will appear here once it&apos;s created. Stay tuned!</p>
              </section>
            )}

            {/* Match day */}
            <section>
              <div className="sec-head" style={{ flexWrap: "wrap", gap: "8px" }}>
                <h2>
                  {selectedDay < todayStr ? "Results" : selectedDay === todayStr ? "Today" : "Upcoming"}{selectedDayLabel ? ` — ${selectedDayLabel}` : ""}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {prevDay && (
                    <Link href={`/?day=${prevDay}`} className="tag-soft" style={{ fontWeight: 700, fontSize: "12px" }}>
                      ← {fmtDayLabel(prevDay)}
                    </Link>
                  )}
                  {nextDay && (
                    <Link href={`/?day=${nextDay}`} className="tag-soft" style={{ fontWeight: 700, fontSize: "12px" }}>
                      {fmtDayLabel(nextDay)} →
                    </Link>
                  )}
                  <Link href="/standings" className="tag-soft" style={{ fontWeight: 700 }}>Bracket →</Link>
                </div>
              </div>
              {selectedDayMatches.length === 0 ? (
                <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-faint)", fontSize: "14px" }}>
                  {allDays.length === 0 ? "No matches scheduled yet." : "No matches on this day."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                  {selectedDayMatches.map((m) => {
                    const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                    const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
                    const kickoff = fmtTime(m.matchDate?.toISOString());

                    const mr: MatchResult = {
                      stage: m.stage as MatchResult["stage"],
                      tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
                      homeTeam: m.homeTeam, awayTeam: m.awayTeam,
                      homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
                      penaltyWinner: m.penaltyWinner ?? null,
                    };

                    const payouts = payoutRules ? playerIds.flatMap((uid: string) => {
                      const teams = teamsByPlayer.get(uid) ?? new Set<string>();
                      const cents = matchEarningsCents(mr, teams.has(m.homeTeam), teams.has(m.awayTeam), payoutRules);
                      if (cents === 0) return [];
                      const u = userById.get(uid);
                      return [{ playerId: uid, playerName: u?.name ?? u?.email?.split("@")[0] ?? "?", colorIdx: colorOf(uid), cents }];
                    }) : [];

                    return (
                      <div key={m.id} className="card" style={{ padding: "14px 15px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "11px" }}>
                          <span className="kicker">{STAGE_LABELS[m.stage] ?? m.stage}{m.groupName ? ` · Grp ${m.groupName}` : ""}</span>
                          {m.played
                            ? <span className="badge grass" style={{ height: "20px" }}>Final</span>
                            : <span className="tag-soft" style={{ fontWeight: 700 }}>{kickoff ?? ""}</span>
                          }
                        </div>
                        {/* Home team */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0", opacity: m.played && !homeWon ? .5 : 1 }}>
                          <CountryFlag code={m.homeTeam} label={TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam} className="fi-rect flag-lg" />
                          <span style={{ fontWeight: 700, fontSize: "15px", flex: 1 }}>{TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam}</span>
                          {m.played && <span className="mono" style={{ fontWeight: 700, fontSize: "18px" }}>{m.homeScore}</span>}
                        </div>
                        {!m.played && <div className="faint" style={{ fontSize: "13px", fontWeight: 600, paddingLeft: "40px" }}>vs</div>}
                        {/* Away team */}
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0", opacity: m.played && !awayWon ? .5 : 1 }}>
                          <CountryFlag code={m.awayTeam} label={TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam} className="fi-rect flag-lg" />
                          <span style={{ fontWeight: 700, fontSize: "15px", flex: 1 }}>{TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam}</span>
                          {m.played && <span className="mono" style={{ fontWeight: 700, fontSize: "18px" }}>{m.awayScore}</span>}
                        </div>
                        {m.penaltyWinner && <div style={{ fontSize: "11px", color: "var(--gold-deep)", fontWeight: 600, paddingLeft: "40px" }}>pen</div>}
                        {payouts.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "11px", paddingTop: "11px", borderTop: "1px solid var(--line-soft)" }}>
                            {payouts.map((p) => (
                              <span key={p.playerId} className={`m-chip m${p.colorIdx}`}>
                                <span className="mdot"></span>
                                {p.playerName}
                                {p.cents > 0 && <b className="mono" style={{ fontSize: "11px" }}>+{formatDollars(p.cents)}</b>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Leaderboard */}
            {standings.length > 0 && (
              <section className="card card-pad">
                <div className="sec-head" style={{ marginBottom: "6px" }}>
                  <h2 style={{ fontSize: "20px" }}>Leaderboard</h2>
                </div>
                <div>
                  {standings.map((s, i) => (
                    <div key={s.uid} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "9px 4px", borderBottom: i < standings.length - 1 ? "1px solid var(--line-soft)" : "0",
                      borderRadius: "10px",
                      background: s.uid === userId ? "var(--grass-soft)" : "transparent",
                      paddingInline: s.uid === userId ? "10px" : "4px",
                    }}>
                      <span style={{ width: "22px", fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 800, color: "var(--ink-faint)", textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span className={`mdot m${colorOf(s.uid)}`} style={{ flexShrink: 0 }}></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, display: "block" }}>
                          {s.displayName}
                          {s.uid === userId && <span className="faint" style={{ fontSize: "12px", fontWeight: 400 }}> (you)</span>}
                        </span>
                        {s.realSub && <span style={{ fontSize: "11px", color: "var(--ink-faint)", fontWeight: 400 }}>{s.realSub}</span>}
                      </span>
                      <span className="money pos">{formatDollars(s.cents)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: news sidebar */}
          <aside className="home-sidebar">
            <RssFeed />
          </aside>
        </div>
      </div>
    </main>
  );
}



