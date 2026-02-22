import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { calculateLeagueEarnings, type EarningsStageKey } from "@/lib/earnings";

const MANAGERS_PER_LEAGUE = 8;
const LINEUP_SIZE = Math.max(1, Math.ceil(TEAMS.length / MANAGERS_PER_LEAGUE));

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t] as const));

const TEAMS_RANKED = TEAMS.slice().sort(
  (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
);
const RANK_BY_CODE = new Map(TEAMS_RANKED.map((t, idx) => [t.code, idx + 1] as const));

function formatCents(cents: number) {
  const n = Number.isFinite(cents) ? Math.max(0, Math.floor(cents)) : 0;
  return `$${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}

function distributeProRataCents<T extends { key: string; points: number }>(
  poolCents: number,
  rows: T[],
): Record<string, number> {
  const pool = Number.isFinite(poolCents) ? Math.max(0, Math.floor(poolCents)) : 0;
  const out: Record<string, number> = {};
  for (const r of rows) out[r.key] = 0;
  if (!rows.length || pool === 0) return out;

  const pts = rows.map((r) => ({ key: r.key, points: Number.isFinite(r.points) ? Math.max(0, Math.floor(r.points)) : 0 }));
  const total = pts.reduce((s, r) => s + r.points, 0);
  if (total <= 0) return out;

  const raw = pts.map((r) => {
    const exact = (pool * r.points) / total;
    const floor = Math.floor(exact);
    return { key: r.key, floor, frac: exact - floor };
  });

  let paid = raw.reduce((s, r) => s + r.floor, 0);
  let remainder = pool - paid;

  raw.sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key));
  for (let i = 0; i < raw.length && remainder > 0; i += 1) {
    raw[i].floor += 1;
    remainder -= 1;
  }

  for (const r of raw) out[r.key] = r.floor;
  return out;
}

export default async function LineupPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      userId = user?.id;
    }
  }

  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeLeagueId: true },
  });

  const memberships = await prisma.leagueMember.findMany({
    where: { userId, league: { deletedAt: null } },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeMembership =
    memberships.find((m) => m.leagueId === user?.activeLeagueId) ??
    memberships[0] ??
    null;

  if (!activeMembership) {
    redirect("/dashboard?error=Join%20or%20create%20a%20league%20to%20draft");
  }

  if (user?.activeLeagueId !== activeMembership.leagueId) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeLeagueId: activeMembership.leagueId },
    });
  }

  const lineupPicks = await (async () => {
    try {
      return await prisma.lineupPick.findMany({
        where: { leagueId: activeMembership.leagueId, userId },
        orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
        select: { teamCode: true, price: true, createdAt: true, pickNumber: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021") return [];
      if (code === "P2022") {
        return await prisma.lineupPick.findMany({
          where: { leagueId: activeMembership.leagueId, userId },
          orderBy: { createdAt: "asc" },
          select: { teamCode: true, price: true, createdAt: true },
        });
      }
      throw err;
    }
  })();

  const teamPointsRows = await (async () => {
    if (!lineupPicks.length) return [] as Array<{ teamCode: string; points: number }>;
    try {
      return await prisma.teamPoints.findMany({
        where: { teamCode: { in: lineupPicks.map((p) => p.teamCode) } },
        select: { teamCode: true, points: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") return [];
      throw err;
    }
  })();
  const pointsByCode = new Map(teamPointsRows.map((r) => [r.teamCode, r.points]));
  const totalPoints = lineupPicks.reduce(
    (sum, p) => sum + (pointsByCode.get(p.teamCode) ?? 0),
    0,
  );

  const league = await (async () => {
    try {
      return await prisma.league.findUnique({
        where: { id: activeMembership.leagueId },
        select: { buyInCents: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") return { buyInCents: 4000 };
      throw err;
    }
  })();
  const stageKeys: EarningsStageKey[] = [
    "group_w1",
    "group_w2",
    "group_w3",
    "r32",
    "r16",
  ];
  const allPicks = await prisma.lineupPick.findMany({
    where: { leagueId: activeMembership.leagueId },
    select: { userId: true, teamCode: true },
  });
  const teamCodes = Array.from(new Set(allPicks.map((p) => p.teamCode)));
  const stageRows = await (async () => {
    if (!teamCodes.length) return [] as Array<{ teamCode: string; stageKey: string; points: number }>;
    try {
      return await prisma.teamStagePoints.findMany({
        where: {
          teamCode: { in: teamCodes },
          stageKey: { in: stageKeys },
        },
        select: { teamCode: true, stageKey: true, points: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") return [];
      throw err;
    }
  })();
  const stageMap = new Map<string, Map<string, number>>();
  for (const r of stageRows) {
    const byStage = stageMap.get(r.teamCode) ?? new Map<string, number>();
    byStage.set(r.stageKey, r.points);
    stageMap.set(r.teamCode, byStage);
  }
  const overallRows = await (async () => {
    if (!teamCodes.length) return [] as Array<{ teamCode: string; points: number }>;
    try {
      return await prisma.teamPoints.findMany({
        where: { teamCode: { in: teamCodes } },
        select: { teamCode: true, points: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") return [];
      throw err;
    }
  })();
  const overallMap = new Map(overallRows.map((r) => [r.teamCode, r.points]));

  const memberIds = memberships.map((m) => m.userId);
  const pointsByUserId: Record<string, Record<string, number>> = {};
  for (const uid of memberIds) {
    pointsByUserId[uid] = {
      group_w1: 0,
      group_w2: 0,
      group_w3: 0,
      r32: 0,
      r16: 0,
      overallPoints: 0,
    };
  }
  for (const p of allPicks) {
    const slot = pointsByUserId[p.userId];
    if (!slot) continue;
    const byStage = stageMap.get(p.teamCode);
    for (const sk of stageKeys) {
      slot[sk] += byStage?.get(sk) ?? 0;
    }
    slot.overallPoints += overallMap.get(p.teamCode) ?? 0;
  }

  const earnings = calculateLeagueEarnings({
    buyInCents: league?.buyInCents ?? 4000,
    memberUserIds: memberIds,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pointsByUserId: pointsByUserId as any,
  });
  const myEarningsCents = earnings.earnedByUserCents[userId] ?? 0;

  const myTeamCodes = lineupPicks
    .map((p) => String(p.teamCode ?? "").toLowerCase())
    .filter(Boolean);

  const myTeamPayoutCentsByCode = (() => {
    const stageBreakdown = earnings.earnedByUserByStageCents;
    const remainingBreakdown = earnings.earnedByUserRemainingCents;
    if (!stageBreakdown || !remainingBreakdown) return new Map<string, number>();

    const out = new Map<string, number>();
    for (const code of myTeamCodes) out.set(code, 0);

    // Allocate each stage payout across your teams pro-rata by that team's stage points.
    for (const sk of stageKeys) {
      const myStagePool = stageBreakdown[sk]?.[userId] ?? 0;
      if (myStagePool <= 0) continue;

      const rows = myTeamCodes.map((code) => ({
        key: code,
        points: stageMap.get(code)?.get(sk) ?? 0,
      }));
      const centsByTeam = distributeProRataCents(myStagePool, rows);
      for (const code of myTeamCodes) {
        out.set(code, (out.get(code) ?? 0) + (centsByTeam[code] ?? 0));
      }
    }

    // Allocate the remaining pool payout (winner/2nd logic) across your teams pro-rata by overall points.
    const myRemaining = remainingBreakdown[userId] ?? 0;
    if (myRemaining > 0) {
      const rows = myTeamCodes.map((code) => ({
        key: code,
        points: overallMap.get(code) ?? 0,
      }));
      const centsByTeam = distributeProRataCents(myRemaining, rows);
      for (const code of myTeamCodes) {
        out.set(code, (out.get(code) ?? 0) + (centsByTeam[code] ?? 0));
      }
    }

    return out;
  })();

  // Pricing override logic removed

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Your lineup
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              League: {activeMembership.league.name}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Teams</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {lineupPicks.length} / {LINEUP_SIZE}
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Up to {LINEUP_SIZE} picks
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Points</div>
            <div className="mt-1 text-2xl font-semibold text-white">{totalPoints}</div>
            <div className="mt-1 text-sm text-zinc-400">Total lineup points</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Total earnings</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-100">
              {formatCents(myEarningsCents)}
            </div>
            <div className="mt-1 text-sm text-zinc-400">Estimated payout so far</div>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-base font-semibold tracking-tight text-white">
            Picks
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            Your saved teams in this league.
          </p>

          {lineupPicks.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
              You haven’t drafted any teams yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lineupPicks.map((p, idx) => {
                const team = TEAMS_BY_CODE.get(p.teamCode);
                const codeLower = String(p.teamCode ?? "").toLowerCase();
                const teamPoints = pointsByCode.get(p.teamCode) ?? 0;
                const teamPayoutCents = myTeamPayoutCentsByCode.get(codeLower) ?? 0;
                // Pricing logic removed
                const pickLabel =
                  typeof (p as { pickNumber?: number | null }).pickNumber === "number"
                    ? `Pick #${((p as { pickNumber?: number }).pickNumber ?? 0) + 1}`
                    : `Pick #${idx + 1}`;
                return (
                  <div
                    key={p.teamCode}
                    className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/40 p-5 ring-1 ring-inset ring-white/5 backdrop-blur"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0">
                        {team ? (
                          <div className="flex items-start gap-3">
                            <CountryFlag
                              code={team.code}
                              label={team.name}
                              className="h-8 w-12"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {team.name}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">{pickLabel}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                <div className="text-zinc-400">
                                  Points: <span className="font-semibold text-zinc-200">{teamPoints}</span>
                                </div>
                                <div className="text-zinc-400">
                                  Payout: <span className="font-semibold text-emerald-100">{formatCents(teamPayoutCents)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="truncate text-sm font-semibold text-white">
                              {p.teamCode.toUpperCase()}
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              {pickLabel}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              <div className="text-zinc-400">
                                Points: <span className="font-semibold text-zinc-200">{teamPoints}</span>
                              </div>
                              <div className="text-zinc-400">
                                Payout: <span className="font-semibold text-emerald-100">{formatCents(teamPayoutCents)}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-xs font-medium text-zinc-300">
                          Drafted
                        </div>
                        <div className="text-xs text-zinc-400">
                          {p.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
