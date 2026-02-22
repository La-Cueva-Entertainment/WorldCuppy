import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { CountryFlag } from "@/components/CountryFlag";
import { DraftPickTimer } from "@/components/DraftPickTimer";
import TieredTeamsBox from "@/components/TieredTeamsBox";
import { authOptions } from "@/lib/auth";
import { getSnakeTurnUserId } from "@/lib/draft";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const MANAGERS_PER_LEAGUE = 8;
const LINEUP_SIZE = Math.max(1, Math.ceil(TEAMS.length / MANAGERS_PER_LEAGUE));
const PICK_SECONDS = Number.parseInt(process.env.DRAFT_PICK_SECONDS ?? "60", 10) || 60;

const MANAGER_COLOR_KEYS = [
  "rose",
  "amber",
  "lime",
  "emerald",
  "cyan",
  "sky",
  "indigo",
  "fuchsia",
] as const;

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t] as const));

function canManageDraft(role: string) {
  return role === "owner" || role === "co-manager";
}

function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

function shuffle<T>(items: T[]) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sameUserIdSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const as = new Set(a);
  if (as.size !== a.length) return false;
  for (const id of b) if (!as.has(id)) return false;
  return true;
}

export default async function DraftPage({
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

  const memberships = await (async () => {
    try {
      return await prisma.leagueMember.findMany({
        where: { userId, league: { deletedAt: null } },
        select: {
          leagueId: true,
          role: true,
          teamName: true,
          createdAt: true,
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
    } catch (err) {
      if (!isMissingSchemaError(err)) throw err;
      const rows = await prisma.leagueMember.findMany({
        where: { userId, league: { deletedAt: null } },
        select: {
          leagueId: true,
          role: true,
          createdAt: true,
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
      return rows.map((r) => ({ ...r, teamName: null }));
    }
  })();

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

  async function draftTeamAction(formData: FormData) {
    "use server";

    const rawReturnTo = String(formData.get("returnTo") ?? "").trim();
    const returnTo = (() => {
      if (!rawReturnTo) return "";
      try {
        const url = new URL(rawReturnTo, "http://local");
        if (url.pathname !== "/draft") return "";
        if (rawReturnTo.startsWith("http://") || rawReturnTo.startsWith("https://")) return "";
        return url.pathname + (url.search ? url.search : "");
      } catch {
        return "";
      }
    })();

    const hdrs = await headers();
    const refererDraft = (() => {
      const referer = hdrs.get("referer") ?? "";
      try {
        const url = new URL(referer);
        if (url.pathname !== "/draft") return "";
        url.searchParams.delete("error");
        const qs = url.searchParams.toString();
        return url.pathname + (qs ? `?${qs}` : "");
      } catch {
        return "";
      }
    })();

    const rawTier = String(formData.get("tier") ?? "").trim();
    let tier = /^[a-z0-9_-]{1,40}$/i.test(rawTier) ? rawTier : "";
    if (!tier) {
      const referer = hdrs.get("referer") ?? "";
      try {
        const url = new URL(referer);
        const fromUrl = String(url.searchParams.get("tier") ?? "").trim();
        if (/^[a-z0-9_-]{1,40}$/i.test(fromUrl)) tier = fromUrl;
      } catch {
        // ignore
      }
    }

    const redirectToDraft = (error?: string): never => {
      const base = returnTo || refererDraft || (() => {
        const params = new URLSearchParams();
        if (tier) params.set("tier", tier);
        const qs = params.toString();
        return qs ? `/draft?${qs}` : "/draft";
      })();

      if (!error) redirect(base);

      const url = new URL(base, "http://local");
      url.searchParams.set("error", error);
      redirect(url.pathname + "?" + url.searchParams.toString());
    };

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
    const teamCode = String(formData.get("teamCode") ?? "").trim();
    if (!leagueId || !teamCode) redirectToDraft();

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { id: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) {
      redirectToDraft("You cannot draft in that league");
    }

    const team = TEAMS_BY_CODE.get(teamCode) ?? redirectToDraft("Unknown team");

    try {
      await prisma.$transaction(async (tx) => {
        const draft = await tx.leagueDraft.findUnique({
          where: { leagueId },
          select: { status: true, currentPick: true, orderUserIds: true, rounds: true },
        });

        if (!draft || draft.status !== "active") {
          throw new Error("NODRAFT");
        }

        const roundsLimit = Math.min(
          draft.rounds,
          Math.max(1, Math.ceil(TEAMS.length / Math.max(1, draft.orderUserIds.length))),
        );

        const maxPicks = Math.min(draft.orderUserIds.length * roundsLimit, TEAMS.length);
        if (draft.currentPick >= maxPicks) {
          throw new Error("DONE");
        }

        const expectedUserId = getSnakeTurnUserId(draft.orderUserIds, draft.currentPick);
        if (!expectedUserId || expectedUserId !== userId) {
          throw new Error("TURN");
        }

        const myCount = await tx.lineupPick.count({
          where: { leagueId, userId },
        });

        if (myCount >= roundsLimit) {
          throw new Error("FULL");
        }

        const existing = await tx.lineupPick.findUnique({
          where: {
            leagueId_userId_teamCode: {
              leagueId,
              userId,
              teamCode,
            },
          },
          select: { id: true },
        });

        if (existing) {
          throw new Error("DUPLICATE");
        }

        const existingTeam = await tx.lineupPick.findFirst({
          where: { leagueId, teamCode },
          select: { id: true },
        });

        if (existingTeam) {
          throw new Error("TAKEN");
        }

        const price = 0;

        await tx.lineupPick.create({
          data: {
            leagueId,
            userId,
            teamCode,
            price,
            pickNumber: draft.currentPick,
          },
          select: { id: true },
        });

        const updated = await tx.leagueDraft.updateMany({
          where: { leagueId, currentPick: draft.currentPick },
          data: { currentPick: { increment: 1 } },
        });

        if (updated.count !== 1) {
          throw new Error("RACE");
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") {
        redirectToDraft(
          "Database is missing draft tables/columns — run prisma migrate deploy",
        );
      }
      if (message === "DUPLICATE") {
        redirectToDraft("That team is already in your lineup");
      }
      if (message === "FULL") {
        redirectToDraft("You already have the maximum teams");
      }
      if (message === "TAKEN") {
        redirectToDraft("That team is already taken");
      }
      if (message === "TURN") {
        redirectToDraft("Not your turn");
      }
      if (message === "NODRAFT") {
        redirectToDraft("Draft has not started");
      }
      if (message === "DONE") {
        redirectToDraft("Draft is complete");
      }
      redirectToDraft("Could not draft team");
    }

    void team;
    redirectToDraft();
  }

  async function startDraftAction(formData: FormData) {
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
    if (!leagueId) redirect("/draft");

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) {
      redirect("/draft?error=League%20not%20found");
    }

    if (!canManageDraft(membership.role)) {
      redirect("/draft?error=Only%20league%20managers%20can%20start%20a%20draft");
    }

    const members = await prisma.leagueMember.findMany({
      where: { leagueId, league: { deletedAt: null } },
      select: { userId: true },
      orderBy: { createdAt: "asc" },
    });

    if (members.length !== 8) {
      redirect("/draft?error=Draft%20requires%20exactly%208%20managers");
    }

    const memberUserIds = members.map((m) => m.userId);

    const existingDraft = await prisma.leagueDraft.findUnique({
      where: { leagueId },
      select: { status: true, currentPick: true, orderUserIds: true },
    });

    const canUseExistingOrder =
      existingDraft &&
      existingDraft.currentPick === 0 &&
      existingDraft.status !== "active" &&
      existingDraft.orderUserIds.length === memberUserIds.length &&
      sameUserIdSet(existingDraft.orderUserIds, memberUserIds);

    const orderUserIds = canUseExistingOrder
      ? existingDraft.orderUserIds
      : shuffle(memberUserIds);

    try {
      await prisma.$transaction([
        prisma.leagueDraft.upsert({
          where: { leagueId },
          create: {
            leagueId,
            status: "active",
            orderUserIds,
            currentPick: 0,
            rounds: LINEUP_SIZE,
          },
          update: {
            status: "active",
            orderUserIds,
            currentPick: 0,
            rounds: LINEUP_SIZE,
          },
        }),
        prisma.lineupPick.deleteMany({ where: { leagueId } }),
      ]);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") {
        redirect(
          "/draft?error=Database%20is%20missing%20draft%20tables%20%E2%80%94%20run%20prisma%20migrate%20deploy",
        );
      }
      redirect("/draft?error=Could%20not%20start%20draft");
    }

    redirect("/draft");
  }

  async function randomizeDraftOrderAction(formData: FormData) {
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
    if (!leagueId) redirect("/draft");

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { role: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) {
      redirect("/draft?error=League%20not%20found");
    }

    if (!canManageDraft(membership.role)) {
      redirect(
        "/draft?error=Only%20league%20managers%20can%20randomize%20draft%20order",
      );
    }

    const [members, existingDraft, existingPicksCount] = await Promise.all([
      prisma.leagueMember.findMany({
        where: { leagueId, league: { deletedAt: null } },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.leagueDraft.findUnique({
        where: { leagueId },
        select: { status: true, currentPick: true },
      }),
      prisma.lineupPick.count({ where: { leagueId } }).catch(() => 0),
    ]);

    if (members.length !== 8) {
      redirect("/draft?error=Draft%20requires%20exactly%208%20managers");
    }

    if (existingPicksCount > 0 || (existingDraft?.currentPick ?? 0) > 0) {
      redirect("/draft?error=Cannot%20randomize%20after%20draft%20has%20started");
    }

    const orderUserIds = shuffle(members.map((m) => m.userId));

    try {
      await prisma.leagueDraft.upsert({
        where: { leagueId },
        create: {
          leagueId,
          status: "pending",
          orderUserIds,
          currentPick: 0,
          rounds: LINEUP_SIZE,
        },
        update: {
          status: "pending",
          orderUserIds,
          currentPick: 0,
          rounds: LINEUP_SIZE,
        },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") {
        redirect(
          "/draft?error=Database%20is%20missing%20draft%20tables%20%E2%80%94%20run%20prisma%20migrate%20deploy",
        );
      }
      redirect("/draft?error=Could%20not%20randomize%20draft%20order");
    }

    redirect("/draft");
  }

  async function tickDraftAction(formData: FormData) {
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
    if (!leagueId) return;

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { id: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) return;

    const teamsRanked = TEAMS.slice().sort(
      (a, b) => a.rank - b.rank || a.name.localeCompare(b.name),
    );

    try {
      await prisma.$transaction(async (tx) => {
        const draft = await tx.leagueDraft.findUnique({
          where: { leagueId },
          select: {
            status: true,
            currentPick: true,
            orderUserIds: true,
            rounds: true,
            updatedAt: true,
          },
        });

        if (!draft || draft.status !== "active") return;

        const roundsLimit = Math.min(
          draft.rounds,
          Math.max(1, Math.ceil(TEAMS.length / Math.max(1, draft.orderUserIds.length))),
        );

        const maxPicks = Math.min(draft.orderUserIds.length * roundsLimit, TEAMS.length);
        if (draft.currentPick >= maxPicks) return;

        const expectedUserId = getSnakeTurnUserId(draft.orderUserIds, draft.currentPick);
        if (!expectedUserId) return;

        const expectedUser = await tx.user.findUnique({
          where: { id: expectedUserId },
          select: { email: true },
        });

        const botPrefix = `bot+${leagueId}+`;
        const isBot = (expectedUser?.email ?? "").toLowerCase().trim().startsWith(botPrefix);

        const pickAgeMs = Date.now() - new Date(draft.updatedAt).getTime();
        if (!isBot && pickAgeMs < PICK_SECONDS * 1000) return;

        const expectedUserPickCount = await tx.lineupPick.count({
          where: { leagueId, userId: expectedUserId },
        });

        if (expectedUserPickCount >= roundsLimit) {
          const updated = await tx.leagueDraft.updateMany({
            where: { leagueId, currentPick: draft.currentPick },
            data: { currentPick: { increment: 1 } },
          });

          if (updated.count !== 1) {
            throw new Error("RACE");
          }
          return;
        }

        const taken = await tx.lineupPick.findMany({
          where: { leagueId },
          select: { teamCode: true },
        });

        const takenCodes = new Set(taken.map((p) => p.teamCode));
        const chosen = teamsRanked.find((t) => !takenCodes.has(t.code));
        if (!chosen) {
          await tx.leagueDraft.updateMany({
            where: { leagueId, currentPick: draft.currentPick },
            data: { currentPick: maxPicks },
          });
          return;
        }

        await tx.lineupPick.create({
          data: {
            leagueId,
            userId: expectedUserId,
            teamCode: chosen.code,
            price: 0,
            pickNumber: draft.currentPick,
          },
          select: { id: true },
        });

        const updated = await tx.leagueDraft.updateMany({
          where: { leagueId, currentPick: draft.currentPick },
          data: { currentPick: { increment: 1 } },
        });

        if (updated.count !== 1) {
          throw new Error("RACE");
        }
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2002") {
        // Another request already advanced the draft.
        return;
      }
      const message = err instanceof Error ? err.message : "";
      if (message === "RACE") return;
      throw err;
    }
  }

  async function setTeamNameAction(formData: FormData) {
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
    if (!leagueId) redirect("/draft");

    const rawName = String(formData.get("teamName") ?? "");
    const normalized = rawName.trim().replace(/\s+/g, " ");
    if (normalized.length > 15) {
      redirect("/draft?error=Team%20name%20must%20be%2015%20characters%20or%20less");
    }
    const teamName = normalized;

    const membership = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      select: { id: true, league: { select: { deletedAt: true } } },
    });

    if (!membership || membership.league.deletedAt) {
      redirect("/draft?error=League%20not%20found");
    }

    try {
      await prisma.leagueMember.update({
        where: { leagueId_userId: { leagueId, userId } },
        data: { teamName: teamName ? teamName : null },
      });
    } catch (err) {
      if (isMissingSchemaError(err)) {
        redirect(
          "/draft?error=Database%20is%20missing%20team%20name%20column%20%E2%80%94%20run%20prisma%20migrate%20deploy",
        );
      }
      throw err;
    }

    redirect("/draft");
  }

  if (!activeMembership) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-7xl px-6 py-10">
          <h1 className="text-xl font-semibold tracking-tight text-white">Draft</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Join or create a league before drafting.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Go to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const lineupPicks = await (async () => {
    try {
      return await prisma.lineupPick.findMany({
        where: { leagueId: activeMembership.leagueId, userId },
        orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
        select: { teamCode: true, createdAt: true, pickNumber: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021") return [];
      if (code === "P2022") {
        return await prisma.lineupPick.findMany({
          where: { leagueId: activeMembership.leagueId, userId },
          orderBy: { createdAt: "asc" },
          select: { teamCode: true, createdAt: true },
        });
      }
      throw err;
    }
  })();

  const leaguePicks = await (async () => {
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
  })();

  const pickedTeamCodes = new Set(lineupPicks.map((p) => p.teamCode));
  const takenTeamCodes = new Set(leaguePicks.map((p) => p.teamCode));

  const draft = await (async () => {
    try {
      return await prisma.leagueDraft.findUnique({
        where: { leagueId: activeMembership.leagueId },
        select: { status: true, currentPick: true, orderUserIds: true, rounds: true, updatedAt: true },
      });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2021" || code === "P2022") return null;
      throw err;
    }
  })();

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

  const expectedTurnUserId =
    draftActive && draft ? getSnakeTurnUserId(draft.orderUserIds, draft.currentPick) : null;

  const canPickNow = Boolean(expectedTurnUserId && expectedTurnUserId === userId);
  const canStartDraft = Boolean(canManageDraft(activeMembership.role));

  const activeLeagueMembers = await (async () => {
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
  })();

  const botPrefix = `bot+${activeMembership.leagueId}+`;
  const memberEmailByUserId = new Map(
    activeLeagueMembers.map((m) => [m.userId, (m.user.email ?? "").toLowerCase().trim()] as const),
  );

  const memberLabelByUserId = new Map(
    activeLeagueMembers.map((m) => {
      const teamNameLabel = m.teamName?.trim().replace(/\s+/g, " ").slice(0, 15) || "";
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
      map.set(ids[i]!, i % MANAGER_COLOR_KEYS.length);
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

  const onTheClockIsBot = Boolean(
    expectedTurnUserId && (memberEmailByUserId.get(expectedTurnUserId) ?? "").startsWith(botPrefix),
  );

  const draftOrderLabels = draft?.orderUserIds?.length
    ? draft.orderUserIds.map((id, idx) => {
        const label = memberLabelByUserId.get(id) ?? `${id.slice(0, 6)}…`;
        return { idx: idx + 1, userId: id, label };
      })
    : [];

  const currentRoundNumber =
    draftActive && draft && managersCount > 0
      ? Math.floor(draft.currentPick / managersCount) + 1
      : null;

  const currentPickInRound =
    draftActive && draft && managersCount > 0
      ? (draft.currentPick % managersCount) + 1
      : null;

  const teamsRanked = TEAMS.slice().sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

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
      rank: t.rank,
    })),
  }));

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Draft</h1>
            <p className="mt-1 text-sm text-zinc-300">
              Active league: {activeMembership.league.name}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Back to dashboard
          </Link>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-inset ring-red-500/20">
            {resolvedSearchParams.error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                {draftActive && draft?.updatedAt ? (
                  <DraftPickTimer
                    enabled={true}
                    leagueId={activeMembership.leagueId}
                    pickSeconds={PICK_SECONDS}
                    pickStartedAtIso={new Date(draft.updatedAt).toISOString()}
                    onTheClockLabel={onTheClockLabel}
                    onTheClockIsBot={onTheClockIsBot}
                    tickDraftAction={tickDraftAction}
                  />
                ) : null}

                {!draftActive && draftOrderLabels.length ? (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-zinc-300">Draft order</div>
                    <div className="mt-1 grid gap-1 text-xs text-zinc-400">
                      {draftOrderLabels.map((row) => (
                        <div key={row.userId} className="flex items-center gap-2">
                          <span className="w-6 text-zinc-500">#{row.idx}</span>
                          <span
                            className={
                              "h-2 w-2 rounded-full " +
                              [
                                "bg-rose-400",
                                "bg-amber-400",
                                "bg-lime-400",
                                "bg-emerald-400",
                                "bg-cyan-400",
                                "bg-sky-400",
                                "bg-indigo-400",
                                "bg-fuchsia-400",
                              ][(colorIndexByUserId.get(row.userId) ?? 0) % 8]
                            }
                            aria-hidden
                          />
                          <span className="truncate text-zinc-300">{row.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500">
                      Snake draft: Round 2 reverses this order.
                    </div>
                  </div>
                ) : null}
              </div>

              {canStartDraft ? (
                <div className="flex flex-col items-end gap-2">
                  {!draftActive ? (
                    <form action={randomizeDraftOrderAction}>
                      <input type="hidden" name="leagueId" value={activeMembership.leagueId} />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                      >
                        Randomize order
                      </button>
                    </form>
                  ) : null}

                  <form action={startDraftAction}>
                    <input type="hidden" name="leagueId" value={activeMembership.leagueId} />
                    <ConfirmSubmitButton
                      confirmText={
                        "Start/restart the draft? This will clear all existing picks."
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                    >
                      Start draft
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Your teams</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {lineupPicks.length} / {LINEUP_SIZE}
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Draft your lineup in this league
            </div>

            <form action={setTeamNameAction} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="leagueId" value={activeMembership.leagueId} />
              <input
                name="teamName"
                defaultValue={activeMembership.teamName ?? ""}
                placeholder="Your team name"
                maxLength={15}
                className="h-9 w-full rounded-xl border border-white/10 bg-zinc-950/40 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500/40"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-white/5 px-3 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
              >
                Save
              </button>
            </form>
            <div className="mt-1 text-xs text-zinc-500">Shown on drafted teams. Max 15 characters.</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-medium text-zinc-200">Lineup</div>
            <div className="mt-2">
              <Link
                href="/lineup"
                className="inline-flex items-center rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
              >
                View lineup
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">Teams</h2>
              <p className="mt-1 text-sm text-zinc-300">
                Draft buttons only show on this page.
              </p>
            </div>
          </div>

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

          <TieredTeamsBox
            tiers={tiersForClient}
            initialTierKey={initialTierKey}
            takenTeamCodes={[...takenTeamCodes]}
            myTeamCodes={[...pickedTeamCodes]}
            takenBy={takenByTeamCode}
            canDraft={true}
            canPickNow={canPickNow}
            activeLeagueId={activeMembership.leagueId}
            picksCount={lineupPicks.length}
            lineupSize={LINEUP_SIZE}
            draftTeamAction={draftTeamAction}
            showDraftControls={true}
          />
        </div>
      </main>
    </div>
  );
}
