import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, totalEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const PLAYER_COLORS = [
  { bg: "bg-emerald-50", ring: "ring-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
  { bg: "bg-amber-50", ring: "ring-amber-300", text: "text-amber-700", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800" },
  { bg: "bg-sky-50", ring: "ring-sky-300", text: "text-sky-700", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-800" },
  { bg: "bg-rose-50", ring: "ring-rose-300", text: "text-rose-700", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-800" },
  { bg: "bg-purple-50", ring: "ring-purple-300", text: "text-purple-700", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-800" },
  { bg: "bg-orange-50", ring: "ring-orange-300", text: "text-orange-700", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-800" },
  { bg: "bg-cyan-50", ring: "ring-cyan-300", text: "text-cyan-700", dot: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800" },
  { bg: "bg-fuchsia-50", ring: "ring-fuchsia-300", text: "text-fuchsia-700", dot: "bg-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-800" },
];

function colorFor(idx: number) {
  return PLAYER_COLORS[idx % PLAYER_COLORS.length];
}

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter Final",
  sf: "Semi Final",
  "3rd": "3rd Place",
  final: "Final",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Find active tournament
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
        <div className="mb-8"><CountdownTimer /></div>
        <div className="text-5xl mb-4">🔜</div>
        <h1 className="text-2xl font-bold text-slate-900">No active tournament yet</h1>
        <p className="mt-2 text-slate-500">An admin will set up the next tournament shortly.</p>
      </main>
    );
  }

  const [picks, matches, users, adjustments] = await Promise.all([
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
      select: { userId: true, amountCents: true, reason: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));

  // Collect all unique player IDs that have picks
  const playerIds = [...new Set(picks.map((p) => p.userId))].sort();

  // Build team → [userId] map
  const teamOwners = new Map<string, string[]>();
  for (const p of picks) {
    const arr = teamOwners.get(p.teamCode) ?? [];
    arr.push(p.userId);
    teamOwners.set(p.teamCode, arr);
  }

  // Build userId → Set<teamCode>
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of picks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  // Compute earnings per player
  const matchResults: MatchResult[] = matches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const earnings = new Map<string, number>();
  for (const uid of playerIds) {
    const teams = teamsByPlayer.get(uid) ?? new Set<string>();
    const earned = totalEarningsCents(matchResults, teams);
    const adj = adjustments
      .filter((a) => a.userId === uid)
      .reduce((s, a) => s + a.amountCents, 0);
    earnings.set(uid, earned + adj);
  }

  // Sort players by earnings desc
  const ranked = playerIds
    .map((uid, i) => ({ uid, earnings: earnings.get(uid) ?? 0, colorIdx: i }))
    .sort((a, b) => b.earnings - a.earnings);

  // Today's matches
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayMatches = await prisma.match.findMany({
    where: {
      tournamentId: tournament.id,
      matchDate: { gte: todayStart, lte: todayEnd },
    },
    orderBy: { matchDate: "asc" },
    select: {
      id: true, stage: true, groupName: true,
      homeTeam: true, awayTeam: true,
      homeScore: true, awayScore: true,
      penaltyWinner: true, played: true, matchDate: true,
    },
  });

  // Per-match payouts: matchId → { userId → cents }
  type MatchPayouts = Map<string, Map<string, number>>;
  const matchPayouts: MatchPayouts = new Map();
  for (const m of todayMatches) {
    const mr: MatchResult = {
      stage: m.stage as MatchResult["stage"],
      tournamentType: tournament.type as MatchResult["tournamentType"],
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore ?? 0,
      awayScore: m.awayScore ?? 0,
      penaltyWinner: m.penaltyWinner ?? null,
    };
    const perPlayer = new Map<string, number>();
    for (const uid of playerIds) {
      const teams = teamsByPlayer.get(uid) ?? new Set<string>();
      const cents = matchEarningsCents(mr, teams.has(m.homeTeam), teams.has(m.awayTeam));
      if (cents > 0) perPlayer.set(uid, cents);
    }
    matchPayouts.set(m.id, perPlayer);
  }

  // Bracket: group matches by stage
  const allMatches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, stage: true, groupName: true,
      homeTeam: true, awayTeam: true,
      homeScore: true, awayScore: true,
      penaltyWinner: true, played: true, matchDate: true,
    },
  });

  const matchesByStage = new Map<string, typeof allMatches>();
  const stageOrder = ["group", "r32", "r16", "qf", "sf", "3rd", "final"];
  for (const stage of stageOrder) matchesByStage.set(stage, []);
  for (const m of allMatches) {
    const arr = matchesByStage.get(m.stage) ?? [];
    arr.push(m);
    matchesByStage.set(m.stage, arr);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Countdown */}
      <div className="mb-8">
        <CountdownTimer />
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900">
            {tournament.name}{" "}
            <span className="text-emerald-600">{tournament.year}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500 capitalize">{tournament.status}</p>
        </div>
        <Link
          href="/draft"
          className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go to Draft →
        </Link>
      </div>

      {/* Today's Matches */}
      {todayMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Today&apos;s Matches
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayMatches.map((m) => {
              const home = TEAMS_BY_CODE.get(m.homeTeam);
              const away = TEAMS_BY_CODE.get(m.awayTeam);
              const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
              const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
              const payouts = matchPayouts.get(m.id) ?? new Map<string, number>();
              const kickoff = m.matchDate
                ? new Date(m.matchDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : null;
              return (
                <div key={m.id} className={`rounded-2xl border p-4 ${
                  m.played ? "border-zinc-200 bg-white shadow-sm" : "border-zinc-100 bg-zinc-50"
                }`}>
                  {/* Meta row */}
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    <span>{STAGE_LABELS[m.stage] ?? m.stage}{m.groupName ? ` · Grp ${m.groupName}` : ""}</span>
                    {kickoff && !m.played && <span>{kickoff}</span>}
                    {m.played && <span className="text-emerald-600">Final</span>}
                  </div>

                  {/* Teams + Score */}
                  <div className="flex items-center gap-2">
                    <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                      m.played && !homeWon ? "opacity-50" : ""
                    }`}>
                      <CountryFlag code={m.homeTeam} label={home?.name ?? m.homeTeam} className="h-5 w-7 shrink-0" />
                      <span className="truncate text-sm font-semibold text-zinc-900">{home?.name ?? m.homeTeam}</span>
                    </div>
                    <div className="shrink-0 text-center">
                      {m.played ? (
                        <span className="font-mono text-base font-bold text-zinc-900">
                          {m.homeScore}<span className="text-zinc-400"> – </span>{m.awayScore}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">vs</span>
                      )}
                      {m.penaltyWinner && (
                        <div className="text-[10px] text-amber-600">pens</div>
                      )}
                    </div>
                    <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-1.5 ${
                      m.played && !awayWon ? "opacity-50" : ""
                    }`}>
                      <CountryFlag code={m.awayTeam} label={away?.name ?? m.awayTeam} className="h-5 w-7 shrink-0" />
                      <span className="truncate text-right text-sm font-semibold text-zinc-900">{away?.name ?? m.awayTeam}</span>
                    </div>
                  </div>

                  {/* Payout badges */}
                  {payouts.size > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                      {[...payouts.entries()].map(([uid, cents]) => {
                        const u = userById.get(uid);
                        const name = u?.name ?? u?.email?.split("@")[0] ?? "?";
                        const playerIdx = playerIds.indexOf(uid);
                        const c = colorFor(playerIdx);
                        return (
                          <span key={uid} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${c.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                            {name} +{formatDollars(cents)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        {/* — Standings — */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Standings
          </h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-500">
                  <th className="py-3 pl-4 text-left font-medium">#</th>
                  <th className="py-3 text-left font-medium">Player</th>
                  <th className="py-3 pr-4 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => {
                  const c = colorFor(row.colorIdx);
                  const user = userById.get(row.uid);
                  const teams = [...(teamsByPlayer.get(row.uid) ?? [])];
                  return (
                    <tr key={row.uid} className="border-b border-zinc-50 hover:bg-zinc-50">
                      <td className="py-3 pl-4 font-mono text-zinc-400">{i + 1}</td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                            <span className="font-semibold text-zinc-900">
                              {user?.name ?? user?.email ?? row.uid.slice(0, 8)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pl-4">
                            {teams.map((code) => {
                              const t = TEAMS_BY_CODE.get(code);
                              return (
                                <span key={code} className="flex min-w-0 items-center gap-1 overflow-hidden rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                                  <CountryFlag code={code} label={t?.name ?? code} className="h-3 w-4 shrink-0" />
                                  <span className="truncate">{t?.name ?? code}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold tabular-nums ${c.text}`}>
                        {formatDollars(row.earnings)}
                      </td>
                    </tr>
                  );
                })}
                {ranked.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-zinc-400">
                      No picks yet — go draft your teams!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* — Bracket / Match Results — */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Tournament Bracket
          </h2>
          <div className="space-y-6">
            {stageOrder.map((stage) => {
              const stageMatches = matchesByStage.get(stage) ?? [];
              if (stageMatches.length === 0) return null;
              return (
                <div key={stage}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {STAGE_LABELS[stage] ?? stage}
                  </h3>
                  <div className={`grid gap-2 ${stage === "group" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                    {stageMatches.map((m) => {
                      const home = TEAMS_BY_CODE.get(m.homeTeam);
                      const away = TEAMS_BY_CODE.get(m.awayTeam);
                      const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                      const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);

                      // Find who owns these teams
                      const homeOwnerIds = teamOwners.get(m.homeTeam) ?? [];
                      const awayOwnerIds = teamOwners.get(m.awayTeam) ?? [];
                      const getOwnerNames = (ids: string[]) =>
                        ids.map((id) => {
                          const u = userById.get(id);
                          return u?.name ?? u?.email?.split("@")[0] ?? "?";
                        }).join(", ");

                      return (
                        <div
                          key={m.id}
                          className={`rounded-xl border px-4 py-3 ${
                            m.played
                              ? "border-zinc-200 bg-white shadow-sm"
                              : "border-zinc-100 bg-zinc-50 opacity-70"
                          }`}
                        >
                          {m.groupName && (
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                              Group {m.groupName}
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            {/* Home */}
                            <div className={`flex min-w-0 flex-1 items-center gap-2 ${m.played && !homeWon ? "opacity-40" : ""}`}>
                              <CountryFlag code={m.homeTeam} label={home?.name ?? m.homeTeam} className="h-5 w-7 shrink-0" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-zinc-900">
                                  {home?.name ?? m.homeTeam}
                                </div>
                                {homeOwnerIds.length > 0 && (
                                  <div className="truncate text-[10px] text-zinc-400">{getOwnerNames(homeOwnerIds)}</div>
                                )}
                              </div>
                            </div>

                            {/* Score */}
                            <div className="shrink-0 text-center">
                              {m.played ? (
                                <div className="flex items-center gap-1.5 font-mono text-base font-bold">
                                  <span className={homeWon ? "text-zinc-900" : "text-zinc-400"}>{m.homeScore}</span>
                                  <span className="text-zinc-300">–</span>
                                  <span className={awayWon ? "text-zinc-900" : "text-zinc-400"}>{m.awayScore}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-400">vs</span>
                              )}
                              {m.penaltyWinner && (
                                <div className="text-[10px] text-amber-600">pens</div>
                              )}
                            </div>

                            {/* Away */}
                            <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-2 text-right ${m.played && !awayWon ? "opacity-40" : ""}`}>
                              <CountryFlag code={m.awayTeam} label={away?.name ?? m.awayTeam} className="h-5 w-7 shrink-0" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-zinc-900">
                                  {away?.name ?? m.awayTeam}
                                </div>
                                {awayOwnerIds.length > 0 && (
                                  <div className="truncate text-[10px] text-zinc-400">{getOwnerNames(awayOwnerIds)}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {allMatches.length === 0 && (
              <p className="text-center text-zinc-500 py-8">
                No matches entered yet. Admin can add them via the Admin panel.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

