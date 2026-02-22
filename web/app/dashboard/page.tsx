import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import TieredTeamsBox from "@/components/TieredTeamsBox";
import { calculateLeagueEarnings, type EarningsStageKey } from "@/lib/earnings";
import { getSnakeTurnUserId } from "@/lib/draft";

const MANAGERS_PER_LEAGUE = 8;
const LINEUP_SIZE = Math.max(1, Math.ceil(TEAMS.length / MANAGERS_PER_LEAGUE));

function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t] as const));

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?:
    | { error?: string; tier?: string }
    | Promise<{ error?: string; tier?: string }>;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;
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

  async function createLeagueAction(formData: FormData) {
    "use server";

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
    const name = String(formData.get("name") ?? "").trim();
    if (!name) redirect("/dashboard?error=League%20name%20is%20required");

    const existing = await prisma.league.findFirst({
      where: {
        createdById: userId,
        name,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeLeagueId: existing.id },
      });
      redirect("/dashboard?error=You%20already%20have%20a%20league%20with%20that%20name");
    }

    try {
      await prisma.$transaction(async (tx) => {
        const league = await tx.league.create({
          data: {
            name,
            createdById: userId,
          },
          select: { id: true },
        });

        await tx.leagueMember.create({
          data: {
            leagueId: league.id,
            userId,
            role: "owner",
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { activeLeagueId: league.id },
        });
      });
    } catch {
      redirect("/dashboard?error=Could%20not%20create%20league");
    }

    redirect("/dashboard");
  }

  async function setActiveLeagueAction(formData: FormData) {
    "use server";

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
    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/dashboard");

    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
      select: { id: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) {
      redirect("/dashboard?error=You%20cannot%20switch%20to%20that%20league");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { activeLeagueId: leagueId },
    });

    redirect("/dashboard");
  }

  async function leaveLeagueAction(formData: FormData) {
    "use server";

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

    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/dashboard");

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true },
    });

    if (!membership) redirect("/dashboard");
    if (membership.role === "owner") {
      redirect("/dashboard?error=Owners%20must%20delete%20the%20league%20instead%20of%20leaving");
    }

    await prisma.$transaction([
      prisma.leagueMember.delete({
        where: { leagueId_userId: { leagueId, userId } },
      }),
      prisma.user.updateMany({
        where: { id: userId, activeLeagueId: leagueId },
        data: { activeLeagueId: null },
      }),
    ]);

    redirect("/dashboard");
  }

  async function deleteLeagueAction(formData: FormData) {
    "use server";

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

    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/dashboard");

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true },
    });

    if (!membership) redirect("/dashboard?error=League%20not%20found");
    if (membership.role !== "owner") {
      redirect("/dashboard?error=Only%20owners%20can%20delete%20a%20league");
    }

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { deletedAt: true },
    });

    if (!league || league.deletedAt) {
      redirect("/dashboard?error=League%20not%20found");
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { activeLeagueId: leagueId },
        data: { activeLeagueId: null },
      }),
      prisma.league.update({
        where: { id: leagueId },
        data: { deletedAt: new Date() },
      }),
    ]);

    redirect("/dashboard");
  }

  const memberships = await prisma.leagueMember.findMany({
    where: { userId, league: { deletedAt: null } },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          deletedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeLeagueId: true },
  });

  const activeMembership =
    memberships.find((m) => m.leagueId === user?.activeLeagueId) ??
    memberships[0] ??
    null;

  if (activeMembership && user?.activeLeagueId !== activeMembership.leagueId) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeLeagueId: activeMembership.leagueId },
    });
  }


  const lineupPicks = activeMembership
    ? await (async () => {
        try {
          return await prisma.lineupPick.findMany({
            where: { leagueId: activeMembership.leagueId, userId },
            orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
            select: { teamCode: true, price: true, createdAt: true, pickNumber: true },
          });
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "P2021") return [];
          // In case the DB hasn't been migrated to include pickNumber yet.
          if (code === "P2022") {
            return await prisma.lineupPick.findMany({
              where: { leagueId: activeMembership.leagueId, userId },
              orderBy: { createdAt: "asc" },
              select: { teamCode: true, price: true, createdAt: true },
            });
          }
          throw err;
        }
      })()
    : [];

  const leaguePicks = activeMembership
    ? await (async () => {
        try {
          return await prisma.lineupPick.findMany({
            where: { leagueId: activeMembership.leagueId },
            select: { userId: true, teamCode: true, pickNumber: true },
          });
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "P2021") return [];
          if (code === "P2022") {
            return await prisma.lineupPick.findMany({
              where: { leagueId: activeMembership.leagueId },
              select: { userId: true, teamCode: true },
            });
          }
          throw err;
        }
      })()
    : [];

  const pickedTeamCodes = new Set(lineupPicks.map((p) => p.teamCode));
  const takenTeamCodes = new Set(leaguePicks.map((p) => p.teamCode));

  const draft = activeMembership
    ? await (async () => {
        try {
          return await prisma.leagueDraft.findUnique({
            where: { leagueId: activeMembership.leagueId },
            select: { status: true, currentPick: true, orderUserIds: true, rounds: true },
          });
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "P2021" || code === "P2022") return null;
          throw err;
        }
      })()
    : null;

  const totalDraftPicks = draft
    ? Math.min(draft.orderUserIds.length * draft.rounds, TEAMS.length)
    : 0;
  const managersCount = draft ? draft.orderUserIds.length : 0;
  const draftActive = Boolean(
    draft &&
      draft.status === "active" &&
      totalDraftPicks > 0 &&
      draft.currentPick < totalDraftPicks,
  );

  const currentRoundNumber =
    draftActive && draft && managersCount > 0
      ? Math.floor(draft.currentPick / managersCount) + 1
      : null;

  const currentPickInRound =
    draftActive && draft && managersCount > 0
      ? (draft.currentPick % managersCount) + 1
      : null;
  const expectedTurnUserId = draftActive && draft
    ? getSnakeTurnUserId(draft.orderUserIds, draft.currentPick)
    : null;
  const canPickNow = Boolean(activeMembership && expectedTurnUserId && expectedTurnUserId === userId);

  const activeLeagueMembers = activeMembership
    ? await (async () => {
        try {
          return await prisma.leagueMember.findMany({
            where: { leagueId: activeMembership.leagueId, league: { deletedAt: null } },
            select: {
              userId: true,
              teamName: true,
              user: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          });
        } catch (err) {
          if (!isMissingSchemaError(err)) throw err;
          const rows = await prisma.leagueMember.findMany({
            where: { leagueId: activeMembership.leagueId, league: { deletedAt: null } },
            select: {
              userId: true,
              user: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          });
          return rows.map((r) => ({ ...r, teamName: null }));
        }
      })()
    : [];

  const memberLabelByUserId = new Map(
    activeLeagueMembers.map((m) => {
      const teamNameLabel = (m as { teamName?: string | null }).teamName
        ?.trim()
        .replace(/\s+/g, " ")
        .slice(0, 15);
      const label =
        teamNameLabel ||
        m.user.name?.trim() ||
        m.user.email?.trim() ||
        `${m.userId.slice(0, 6)}…`;
      return [m.userId, label] as const;
    }),
  );

  const colorIndexByUserId = (() => {
    const ids =
      draft?.orderUserIds?.length === 8
        ? draft.orderUserIds
        : activeLeagueMembers.map((m) => m.userId);
    const map = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 1) {
      map.set(ids[i]!, i % 8);
    }
    return map;
  })();

  const takenByTeamCode = (() => {
    const out: Record<string, { label: string; colorIndex: number }> = {};
    for (const p of leaguePicks) {
      const code = String(p.teamCode ?? "").toLowerCase();
      if (!code) continue;
      const label = memberLabelByUserId.get(p.userId) ?? "Taken";
      const colorIndex = colorIndexByUserId.get(p.userId) ?? 0;
      out[code] = { label, colorIndex };
    }
    return out;
  })();

  const onTheClockLabel = expectedTurnUserId
    ? expectedTurnUserId === userId
      ? "You"
      : memberLabelByUserId.get(expectedTurnUserId) ?? "Another manager"
    : null;

  const teamPointsRows = await (async () => {
    if (!lineupPicks.length) return [] as Array<{ teamCode: string; points: number }>;
    try {
      return await prisma.teamPoints.findMany({
        where: { teamCode: { in: lineupPicks.map((p) => p.teamCode) } },
        select: { teamCode: true, points: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      // If migrations haven't been applied yet, the points tables won't exist.
      if (code === "P2021" || code === "P2022") return [];
      throw err;
    }
  })();

  const pointsByCode = new Map(teamPointsRows.map((r) => [r.teamCode, r.points]));
  const totalPoints = lineupPicks.reduce(
    (sum, p) => sum + (pointsByCode.get(p.teamCode) ?? 0),
    0,
  );

  let myEarningsCents = 0;
  let myStagePoints = 0;
  if (activeMembership) {
    const memberIds = memberships.map((m) => m.userId);
    const league = await (async () => {
      try {
        return await prisma.league.findUnique({
          where: { id: activeMembership.leagueId },
          select: { buyInCents: true },
        });
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        // Schema not migrated yet (missing column/table)
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

    const teamCodes = Array.from(new Set(leaguePicks.map((p) => p.teamCode)));
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

    const pointsByUserId: Record<string, Record<string, number>> = {};
    for (const userId of memberIds) {
      pointsByUserId[userId] = {
        group_w1: 0,
        group_w2: 0,
        group_w3: 0,
        r32: 0,
        r16: 0,
        overallPoints: 0,
      };
    }

    for (const p of leaguePicks) {
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
    myEarningsCents = earnings.earnedByUserCents[userId] ?? 0;

    const currentStageKey: EarningsStageKey = "group_w1";
    myStagePoints = pointsByUserId[userId]?.[currentStageKey] ?? 0;
  }

  const teamsRanked = TEAMS.slice()
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  const teamsByTier = [
    { key: "tier1", labelBase: "The Elite", minRank: 1, maxRank: 8 },
    { key: "tier2", labelBase: "Contenders", minRank: 9, maxRank: 16 },
    { key: "tier3", labelBase: "Only Upsets", minRank: 17, maxRank: 24 },
    {
      key: "tier4",
      labelBase: "Just Happy To Be Here",
      minRank: 25,
      maxRank: Number.POSITIVE_INFINITY,
    },
  ]
    .map((tier) => ({
      ...tier,
      teams: teamsRanked.filter((t) => t.rank >= tier.minRank && t.rank <= tier.maxRank),
    }))
    .map((tier) => {
      const ranks = tier.teams.map((t) => t.rank);
      const min = ranks.length ? Math.min(...ranks) : null;
      const max = ranks.length ? Math.max(...ranks) : null;
      const rangeLabel =
        min == null || max == null ? "—" : min === max ? `#${min}` : `#${min}–#${max}`;
      return {
        ...tier,
        rangeLabel,
        label: `${tier.labelBase} · ${rangeLabel}`,
      };
    });

  const tierKeys = new Set(teamsByTier.map((t) => t.key));
  const initialTierKeyRaw = String(resolvedSearchParams?.tier ?? "all");
  const initialTierKey = tierKeys.has(initialTierKeyRaw) ? initialTierKeyRaw : "all";

  const tiersForClient = teamsByTier.map((tier) => ({
    key: tier.key,
    labelBase: tier.labelBase,
    label: tier.label,
    rangeLabel: tier.rangeLabel,
    teams: tier.teams.map((t) => ({
      code: t.code,
      name: t.name,
      // coefficient removed
      rank: t.rank,
    })),
  }));

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {activeMembership ? activeMembership.league.name : "Dashboard"}
            </h1>
            <p className="mt-1 text-sm text-zinc-300">Leagues, lineup, and standings.</p>
          </div>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-inset ring-red-500/20">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Leagues
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                You can only access leagues you belong to.
              </p>
            </div>

            <div className="grid w-full max-w-md gap-3">
              <form action={createLeagueAction} className="grid grid-cols-1 gap-2">
                <div className="text-sm font-medium text-zinc-200">
                  Create a league
                </div>
                <div className="flex gap-2">
                  <input
                    name="name"
                    type="text"
                    placeholder="League name"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
                    required
                  />
                  <button
                    type="submit"
                    className="h-11 shrink-0 rounded-xl bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
                You’re not in any leagues yet.
              </div>
            ) : (
              memberships.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {m.league.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {m.league._count.members} member(s) · {m.league.id.slice(0, 6)} · {m.league.createdAt.toLocaleDateString()}
                      </div>
                      {activeMembership?.leagueId === m.leagueId ? (
                        <div className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-100 ring-1 ring-inset ring-emerald-500/20">
                          Active
                        </div>
                      ) : null}
                    </div>
                    {activeMembership?.leagueId === m.leagueId ? null : (
                      <form action={setActiveLeagueAction}>
                        <input type="hidden" name="leagueId" value={m.leagueId} />
                        <button
                          type="submit"
                          className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
                        >
                          Switch
                        </button>
                      </form>
                    )}
                  </div>

                  {m.role === "owner" && activeMembership?.leagueId === m.leagueId ? (
                    <Link
                      href={`/leagues/${m.league.id}/invites`}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
                    >
                      Invite by email
                    </Link>
                  ) : null}

                  {m.role === "owner" || m.role === "co-manager" ? (
                    <Link
                      href={`/leagues/${m.league.id}/settings`}
                      className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-medium text-sky-50 ring-1 ring-inset ring-sky-500/25 hover:bg-sky-500/20"
                    >
                      Manage league
                    </Link>
                  ) : null}

                  {m.role === "owner" ? (
                    <form action={deleteLeagueAction} className="mt-2">
                      <input type="hidden" name="leagueId" value={m.leagueId} />
                      <ConfirmSubmitButton
                        confirmText={`Delete "${m.league.name}"? A site owner can restore it later.`}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/15"
                      >
                        Delete league
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <form action={leaveLeagueAction} className="mt-2">
                      <input type="hidden" name="leagueId" value={m.leagueId} />
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                      >
                        Leave league
                      </button>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-200">Draft</div>
                <div className="mt-1 text-2xl font-semibold text-white">
                  {draftActive ? (canPickNow ? "Your turn" : "In progress") : "Not started"}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  {draft
                    ? `Pick ${Math.min(draft.currentPick + 1, totalDraftPicks)} / ${totalDraftPicks}`
                    : "A league manager must start the draft"}
                </div>
                {draftActive && currentRoundNumber && currentPickInRound ? (
                  <div className="mt-1 text-xs text-zinc-500">
                    Round {currentRoundNumber} · Pick {currentPickInRound}
                  </div>
                ) : null}
                {draftActive && onTheClockLabel ? (
                  <div className="mt-1 text-xs text-zinc-400">
                    On the clock: <span className="text-zinc-200">{onTheClockLabel}</span>
                  </div>
                ) : null}
              </div>

              {activeMembership ? (
                <Link
                  href="/draft"
                  className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                >
                  Open draft
                </Link>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Your teams</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {lineupPicks.length} / {LINEUP_SIZE}
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Draft your lineup in your active league
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Points</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-zinc-400">Stage (Group Week 1)</div>
                <div className="mt-1 text-2xl font-semibold text-white">{myStagePoints}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium text-zinc-400">Overall</div>
                <div className="mt-1 text-xl font-semibold text-white">{totalPoints}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Overall Earnings</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-200">
              ${Math.floor(myEarningsCents / 100)}.{String(myEarningsCents % 100).padStart(2, "0")}
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Teams
              </h2>
              <p className="mt-1 text-sm text-zinc-300">
                View-only tiers. Drafting happens on the Draft page.
              </p>
            </div>
          </div>

          {activeMembership ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Your lineup
                    <span className="ml-2 text-sm font-medium text-zinc-400">
                      ({lineupPicks.length}/{LINEUP_SIZE})
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-300">
                    Active league: {activeMembership.league.name}
                  </div>
                  <div className="mt-2">
                    <Link
                      href="/lineup"
                      className="inline-flex items-center rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                    >
                      View lineup
                    </Link>
                  </div>
                </div>

                <div className="text-sm text-zinc-300">
                  {draftActive ? (
                    canPickNow ? (
                      <span className="font-medium text-white">Your pick</span>
                    ) : (
                      <span className="text-zinc-400">Waiting for your turn</span>
                    )
                  ) : (
                    <span className="text-zinc-400">Draft not started</span>
                  )}
                </div>
              </div>

              {lineupPicks.length === 0 ? (
                <div className="mt-3 text-sm text-zinc-400">
                  Draft up to {LINEUP_SIZE} teams.
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lineupPicks.map((p, idx) => {
                    const team = TEAMS_BY_CODE.get(p.teamCode);
                    const pickLabel =
                      typeof (p as { pickNumber?: number | null }).pickNumber === "number"
                        ? `Pick #${((p as { pickNumber?: number }).pickNumber ?? 0) + 1}`
                        : `Pick #${idx + 1}`;
                    return (
                      <div
                        key={p.teamCode}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/30 px-3 py-2 ring-1 ring-inset ring-white/5"
                      >
                        <div className="min-w-0">
                          {team ? (
                            <div className="flex items-center gap-3">
                              <CountryFlag
                                code={team.code}
                                label={team.name}
                                className="h-6 w-10"
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">
                                  {team.name}
                                </div>
                                <div className="text-xs text-zinc-400">{pickLabel}</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="truncate text-sm font-medium text-white">
                                {p.teamCode.toUpperCase()}
                              </div>
                              <div className="text-xs text-zinc-400">{pickLabel}</div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
              Join or create a league to start drafting.
            </div>
          )}

          <TieredTeamsBox
            tiers={tiersForClient}
            initialTierKey={initialTierKey}
            takenTeamCodes={[...takenTeamCodes]}
            myTeamCodes={[...pickedTeamCodes]}
            takenBy={takenByTeamCode}
            canDraft={false}
            canPickNow={false}
            picksCount={lineupPicks.length}
            lineupSize={LINEUP_SIZE}
            showDraftControls={false}
          />
        </div>
      </main>
    </div>
  );
}
