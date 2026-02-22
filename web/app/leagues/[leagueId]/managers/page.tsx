import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import {
  calculateLeagueEarnings,
  type EarningsStageKey,
  type UserStagePoints,
} from "@/lib/earnings";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const TEAM_BY_CODE = new Map(TEAMS.map((t) => [t.code.toLowerCase(), t] as const));

const COLOR_DOT = [
  "bg-rose-400",
  "bg-amber-400",
  "bg-lime-400",
  "bg-emerald-400",
  "bg-cyan-400",
  "bg-sky-400",
  "bg-indigo-400",
  "bg-fuchsia-400",
] as const;

function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

function formatCents(cents: number) {
  const n = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
}

export default async function LeagueManagersPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { leagueId } = await params;

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

  const acting = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
    select: {
      role: true,
      league: {
        select: { id: true, name: true, deletedAt: true, buyInCents: true },
      },
    },
  });

  if (!acting || acting.league.deletedAt) {
    redirect("/dashboard?error=League%20not%20found");
  }


  const [members, draft, picks] = await Promise.all([
    (async () => {
      try {
        return await prisma.leagueMember.findMany({
          where: { leagueId, league: { deletedAt: null } },
          select: {
            userId: true,
            role: true,
            teamName: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        });
      } catch (err) {
        if (!isMissingSchemaError(err)) throw err;
        const rows = await prisma.leagueMember.findMany({
          where: { leagueId, league: { deletedAt: null } },
          select: {
            userId: true,
            role: true,
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        });
        return rows.map((r) => ({ ...r, teamName: null }));
      }
    })(),
    prisma.leagueDraft
      .findUnique({
        where: { leagueId },
        select: { orderUserIds: true },
      })
      .catch(() => null),
    prisma.lineupPick
      .findMany({
        where: { leagueId },
        select: { userId: true, teamCode: true, pickNumber: true, createdAt: true },
        orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      })
      .catch(() => []),
  ]);

  const memberUserIds = members.map((m) => m.userId);
  const labelByUserId = new Map(
    members.map((m) => {
      const teamNameLabel = m.teamName?.trim().replace(/\s+/g, " ").slice(0, 15) || "";
      const label =
        teamNameLabel ||
        m.user.name?.trim() ||
        m.user.email?.trim() ||
        `${m.userId.slice(0, 6)}…`;
      return [m.userId, label] as const;
    }),
  );

  const orderedIds =
    draft?.orderUserIds?.length === memberUserIds.length && memberUserIds.length > 0
      ? draft.orderUserIds
      : memberUserIds;

  const colorIndexByUserId = new Map<string, number>();
  orderedIds.forEach((id, idx) => colorIndexByUserId.set(id, idx % COLOR_DOT.length));

  const teamCodes = Array.from(
    new Set(picks.map((p) => String(p.teamCode ?? "").toLowerCase()).filter(Boolean)),
  );

  const stageKeys: EarningsStageKey[] = ["group_w1", "group_w2", "group_w3", "r32", "r16"];

  const [overallRows, stageRows] = await Promise.all([
    teamCodes.length
      ? prisma.teamPoints
          .findMany({
            where: { teamCode: { in: teamCodes } },
            select: { teamCode: true, points: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    teamCodes.length
      ? prisma.teamStagePoints
          .findMany({
            where: { teamCode: { in: teamCodes }, stageKey: { in: stageKeys } },
            select: { teamCode: true, stageKey: true, points: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const overallByTeam = new Map(overallRows.map((r) => [r.teamCode.toLowerCase(), r.points] as const));
  const stageByTeam = new Map<string, Map<string, number>>();
  for (const r of stageRows) {
    const code = r.teamCode.toLowerCase();
    const byStage = stageByTeam.get(code) ?? new Map<string, number>();
    byStage.set(r.stageKey, r.points);
    stageByTeam.set(code, byStage);
  }

  const pointsByUserId: Record<string, UserStagePoints> = {};
  for (const uid of memberUserIds) {
    pointsByUserId[uid] = {
      group_w1: 0,
      group_w2: 0,
      group_w3: 0,
      r32: 0,
      r16: 0,
      overallPoints: 0,
    };
  }

  for (const p of picks) {
    const uid = p.userId;
    if (!pointsByUserId[uid]) continue;
    const code = String(p.teamCode ?? "").toLowerCase();
    if (!code) continue;

    pointsByUserId[uid].overallPoints += overallByTeam.get(code) ?? 0;
    const byStage = stageByTeam.get(code);
    for (const sk of stageKeys) {
      pointsByUserId[uid][sk] += byStage?.get(sk) ?? 0;
    }
  }

  const earnings = calculateLeagueEarnings({
    buyInCents: acting.league.buyInCents,
    memberUserIds,
    pointsByUserId,
  });

  const picksByUserId = new Map<string, Array<{ teamCode: string; pickNumber: number | null }>>();
  for (const p of picks) {
    const arr = picksByUserId.get(p.userId) ?? [];
    arr.push({ teamCode: p.teamCode, pickNumber: p.pickNumber ?? null });
    picksByUserId.set(p.userId, arr);
  }

  const rows = members
    .slice()
    .sort((a, b) => {
      const ca = colorIndexByUserId.get(a.userId) ?? 999;
      const cb = colorIndexByUserId.get(b.userId) ?? 999;
      return ca - cb || (labelByUserId.get(a.userId) ?? "").localeCompare(labelByUserId.get(b.userId) ?? "");
    })
    .map((m) => {
      const label = labelByUserId.get(m.userId) ?? "Manager";
      const colorIndex = colorIndexByUserId.get(m.userId) ?? 0;
      const overallPoints = pointsByUserId[m.userId]?.overallPoints ?? 0;
      const payoutCents = earnings.earnedByUserCents[m.userId] ?? 0;
      const drafted = picksByUserId.get(m.userId) ?? [];
      return { ...m, label, colorIndex, overallPoints, payoutCents, drafted };
    });

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Leaderboards
            </h1>
            <p className="mt-1 text-sm text-zinc-300">{acting.league.name}</p>
            <p className="mt-1 text-xs text-zinc-500">
              Pot: {formatCents(earnings.totalPotCents)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/leagues/${leagueId}/settings`}
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Settings
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5 ring-1 ring-inset ring-white/5">
          <div className="grid grid-cols-12 gap-x-4 border-b border-white/10 bg-zinc-950/20 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <div className="col-span-4">Manager</div>
            <div className="col-span-2 text-right">Points</div>
            <div className="col-span-2 text-right pr-2">Payout</div>
            <div className="col-span-4 pl-2">Drafted teams</div>
          </div>

          <div className="divide-y divide-white/10">
            {rows.map((r) => {
              const dot = COLOR_DOT[r.colorIndex % COLOR_DOT.length];
              return (
                <div key={r.userId} className="grid grid-cols-12 gap-x-4 px-4 py-4">
                  <div className="col-span-4 flex min-w-0 items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} aria-hidden />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{r.label}</div>
                      <div className="text-xs text-zinc-500">
                        {r.role === "owner" ? "Owner" : r.role === "co-manager" ? "Co-manager" : "Member"}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 text-right">
                    <div className="text-sm font-semibold text-white">{r.overallPoints}</div>
                    <div className="text-xs text-zinc-500">Overall</div>
                  </div>

                  <div className="col-span-2 text-right pr-2">
                    <div className="text-sm font-semibold text-emerald-100">
                      {formatCents(r.payoutCents)}
                    </div>
                    <div className="text-xs text-zinc-500">Total</div>
                  </div>

                  <div className="col-span-4 pl-2">
                    {r.drafted.length ? (
                      <div className="flex flex-wrap gap-2">
                        {r.drafted
                          .slice()
                          .sort(
                            (a, b) =>
                              (a.pickNumber ?? 999) - (b.pickNumber ?? 999) ||
                              a.teamCode.localeCompare(b.teamCode),
                          )
                          .map((p) => {
                            const team = TEAM_BY_CODE.get(p.teamCode.toLowerCase());
                            const label = team?.name ?? p.teamCode.toUpperCase();
                            return (
                              <div
                                key={`${r.userId}:${p.teamCode}`}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/30 px-2 py-1 ring-1 ring-inset ring-white/5"
                                title={
                                  p.pickNumber != null
                                    ? `Pick #${p.pickNumber + 1}`
                                    : "Drafted team"
                                }
                              >
                                {team ? (
                                  <CountryFlag
                                    code={team.code}
                                    label={team.name}
                                    className="h-4 w-6"
                                  />
                                ) : null}
                                <span className="text-xs font-medium text-zinc-200">{label}</span>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500">No picks yet</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
