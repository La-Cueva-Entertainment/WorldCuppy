import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";
import { TEAMS } from "@/lib/teams";

const CO_MANAGER_ROLE = "co-manager";
const BOT_EMAIL_DOMAIN = "worldcuppy.local";
const BOT_PASSWORD = "botbot";
const DEFAULT_TARGET_MEMBERS = 8;

function canManageLeague(role: string) {
  return role === "owner" || role === CO_MANAGER_ROLE;
}

function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

function SchemaOutOfDate({ backHref }: { backHref: string }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              League settings
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              This page requires the latest database migrations.
            </p>
          </div>
          <Link
            href={backHref}
            className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Back
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-inset ring-red-500/20">
          Database schema is out of date (missing columns/tables). Run migrations
          and restart the dev server.
        </div>

        <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-xs text-zinc-200 ring-1 ring-inset ring-white/5">
cd web
npx prisma migrate dev
# or (production)
npx prisma migrate deploy
        </pre>
      </main>
    </div>
  );
}

export default async function LeagueSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams?: { error?: string; notice?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const allowBots = process.env.NODE_ENV !== "production" || isSiteOwner(session);

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

  let membership: any = null;

  try {
    membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
      include: {
        league: true,
      },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref="/dashboard" />;
    }
    throw err;
  }

  if (!membership || membership.league.deletedAt) {
    redirect("/dashboard?error=League%20not%20found");
  }

  if (!canManageLeague(membership.role)) {
    redirect("/dashboard?error=You%20do%20not%20have%20permission%20to%20manage%20this%20league");
  }

  async function addBotsAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const allowBots = process.env.NODE_ENV !== "production" || isSiteOwner(session);
    if (!allowBots) {
      redirect(`/leagues/${leagueId}/settings?error=Bots%20are%20disabled%20in%20production`);
    }

    const targetMembersRaw = String(formData.get("targetMembers") ?? "").trim();
    const targetMembers = Math.max(
      1,
      Math.min(
        64,
        Number.isFinite(Number(targetMembersRaw))
          ? Math.floor(Number(targetMembersRaw))
          : DEFAULT_TARGET_MEMBERS,
      ),
    );

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
      include: { league: { select: { deletedAt: true } } },
    });
    if (!acting || acting.league.deletedAt) {
      redirect("/dashboard?error=League%20not%20found");
    }
    if (acting.role !== "owner") {
      redirect(`/leagues/${leagueId}/settings?error=Only%20the%20league%20manager%20can%20add%20bots`);
    }

    const existingCount = await prisma.leagueMember.count({
      where: { leagueId },
    });

    const toAdd = Math.max(0, targetMembers - existingCount);
    if (toAdd === 0) {
      redirect(`/leagues/${leagueId}/settings?notice=League%20already%20has%20${existingCount}%20members`);
    }

    const botPrefix = `bot+${leagueId}+`;
    const existingBots = await prisma.user.findMany({
      where: { email: { startsWith: botPrefix } },
      select: { email: true },
    });
    const used = new Set<number>();
    for (const b of existingBots) {
      const email = b.email ?? "";
      const local = email.split("@")[0] ?? "";
      const suffix = local.slice(botPrefix.length);
      const n = Number(suffix);
      if (Number.isFinite(n)) used.add(n);
    }

    const createdEmails: string[] = [];
    const passwordHash = await hash(BOT_PASSWORD, 10);

    await prisma.$transaction(async (tx) => {
      let next = 1;
      for (let k = 0; k < toAdd; k += 1) {
        while (used.has(next)) next += 1;

        const email = `${botPrefix}${next}@${BOT_EMAIL_DOMAIN}`;
        used.add(next);
        next += 1;

        const bot = await tx.user.upsert({
          where: { email },
          update: {
            name: `Bot ${createdEmails.length + 1}`,
            activeLeagueId: leagueId,
            passwordHash,
          },
          create: {
            name: `Bot ${createdEmails.length + 1}`,
            email,
            passwordHash,
            activeLeagueId: leagueId,
          },
          select: { id: true, email: true },
        });

        await tx.leagueMember.upsert({
          where: { leagueId_userId: { leagueId, userId: bot.id } },
          update: {},
          create: { leagueId, userId: bot.id, role: "member" },
        });

        if (bot.email) createdEmails.push(bot.email);
      }
    });

    redirect(
      `/leagues/${leagueId}/settings?notice=Added%20${createdEmails.length}%20bot%20player(s).%20Password%3A%20${encodeURIComponent(
        BOT_PASSWORD,
      )}`,
    );
  }

  async function renameLeagueAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      redirect(`/leagues/${leagueId}/settings?error=League%20name%20is%20required`);
    }

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

    const membership = await (async () => {
      try {
        return await prisma.leagueMember.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          include: { league: { select: { deletedAt: true } } },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/settings?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (!membership || membership.league.deletedAt || !canManageLeague(membership.role)) {
      redirect("/dashboard?error=Forbidden");
    }

    await prisma.league.update({
      where: { id: leagueId },
      data: { name },
    });

    redirect(`/leagues/${leagueId}/settings`);
  }

  async function setCoManagerAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const targetUserId = String(formData.get("userId") ?? "").trim();
    const makeCoManager = String(formData.get("make") ?? "").trim() === "true";

    if (!targetUserId) redirect(`/leagues/${leagueId}/settings`);

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

    const acting = await (async () => {
      try {
        return await prisma.leagueMember.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          include: { league: { select: { deletedAt: true } } },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/settings?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (!acting || acting.league.deletedAt) redirect("/dashboard?error=League%20not%20found");
    if (acting.role !== "owner") {
      redirect(`/leagues/${leagueId}/settings?error=Only%20the%20league%20manager%20can%20set%20co-managers`);
    }

    if (targetUserId === userId) {
      redirect(`/leagues/${leagueId}/settings?error=You%20cannot%20change%20your%20own%20role`);
    }

    const target = await (async () => {
      try {
        return await prisma.leagueMember.findUnique({
          where: { leagueId_userId: { leagueId, userId: targetUserId } },
          select: { role: true },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/settings?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (!target) {
      redirect(`/leagues/${leagueId}/settings?error=Member%20not%20found`);
    }

    if (target.role === "owner") {
      redirect(`/leagues/${leagueId}/settings?error=You%20cannot%20change%20the%20owner%20role`);
    }

    await prisma.leagueMember.update({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
      data: { role: makeCoManager ? CO_MANAGER_ROLE : "member" },
    });

    redirect(`/leagues/${leagueId}/settings`);
  }

  async function undoLastPickAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/dashboard?error=Missing%20league");

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

    const acting = await (async () => {
      try {
        return await prisma.leagueMember.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          include: { league: { select: { deletedAt: true } } },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/settings?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (!acting || acting.league.deletedAt || !canManageLeague(acting.role)) {
      redirect("/dashboard?error=Forbidden");
    }

    try {
      await prisma.$transaction(async (tx) => {
        const draft = await tx.leagueDraft.findUnique({
          where: { leagueId },
          select: { status: true, currentPick: true },
        });

        if (!draft || draft.status !== "active") {
          throw new Error("NODRAFT");
        }

        if (draft.currentPick <= 0) {
          throw new Error("NOPICKS");
        }

        const lastPickNumber = draft.currentPick - 1;

        const pick = await tx.lineupPick.findFirst({
          where: { leagueId, pickNumber: lastPickNumber },
          select: { id: true },
        });

        if (!pick) {
          throw new Error("MISSING");
        }

        await tx.lineupPick.delete({ where: { id: pick.id } });

        const updated = await tx.leagueDraft.updateMany({
          where: { leagueId, currentPick: draft.currentPick },
          data: { currentPick: { decrement: 1 } },
        });

        if (updated.count !== 1) {
          throw new Error("RACE");
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const code = (err as { code?: string } | null)?.code;
      if (isMissingSchemaError(err) || code === "P2021" || code === "P2022") {
        redirect(
          `/leagues/${leagueId}/settings?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
        );
      }
      if (message === "NODRAFT") {
        redirect(`/leagues/${leagueId}/settings?error=Draft%20has%20not%20started`);
      }
      if (message === "NOPICKS") {
        redirect(`/leagues/${leagueId}/settings?error=No%20picks%20to%20undo`);
      }
      if (message === "MISSING") {
        redirect(`/leagues/${leagueId}/settings?error=Last%20pick%20not%20found`);
      }
      redirect(`/leagues/${leagueId}/settings?error=Could%20not%20undo%20pick`);
    }

    redirect(`/leagues/${leagueId}/settings?notice=Undid%20last%20pick`);
  }

  let members: Array<{
    id: string;
    userId: string;
    role: string;
    user: { id: string; email: string | null; name: string | null };
  }> = [];
  try {
    members = await prisma.leagueMember.findMany({
      where: { leagueId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref="/dashboard" />;
    }
    throw err;
  }

  const teamsByCode = new Map(TEAMS.map((t) => [t.code, t] as const));

  let draft: { status: string; currentPick: number } | null = null;
  let lastPick: {
    pickNumber: number | null;
    teamCode: string;
    user: { email: string | null; name: string | null };
  } | null = null;

  try {
    draft = await prisma.leagueDraft.findUnique({
      where: { leagueId },
      select: { status: true, currentPick: true },
    });

    const lastPickNumber =
      draft && draft.status === "active" && draft.currentPick > 0 ? draft.currentPick - 1 : null;

    if (lastPickNumber != null) {
      lastPick = await prisma.lineupPick.findFirst({
        where: { leagueId, pickNumber: lastPickNumber },
        select: {
          pickNumber: true,
          teamCode: true,
          user: { select: { email: true, name: true } },
        },
      });
    }
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref="/dashboard" />;
    }
    throw err;
  }

  const isOwner = membership.role === "owner";
  const botPrefix = `bot+${leagueId}+`;
  const botCount = members.filter((m) => (m.user.email ?? "").startsWith(botPrefix)).length;

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              League settings
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              League: {membership.league.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/leagues/${leagueId}/invites`}
              className="rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
            >
              Invites
            </Link>
            <Link
              href={`/leagues/${leagueId}/managers`}
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Leaderboards
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Back
            </Link>
          </div>
        </div>

        {searchParams?.error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-inset ring-red-500/20">
            {searchParams.error}
          </div>
        ) : null}

        {searchParams?.notice ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 ring-1 ring-inset ring-emerald-500/20">
            {searchParams.notice}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <h2 className="text-base font-semibold text-white">League name</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Update the display name of this league.
          </p>

          <form action={renameLeagueAction} className="mt-4 flex gap-2">
            <input
              name="name"
              type="text"
              defaultValue={membership.league.name}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
              required
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-xl bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
            >
              Save
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <h2 className="text-base font-semibold text-white">Managers</h2>
          <p className="mt-1 text-sm text-zinc-300">
            The league manager can add or remove co-managers.
          </p>

          <div className="mt-4 grid gap-3">
            {members.map((m) => {
              const label =
                m.role === "owner"
                  ? "Manager"
                  : m.role === CO_MANAGER_ROLE
                    ? "Co-manager"
                    : "Member";

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {m.user.name ?? m.user.email ?? "Unknown"}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {m.user.email ?? "—"} · {label}
                      </div>
                    </div>

                    {isOwner && m.role !== "owner" ? (
                      m.role === CO_MANAGER_ROLE ? (
                        <form action={setCoManagerAction} className="flex gap-2">
                          <input type="hidden" name="userId" value={m.userId} />
                          <input type="hidden" name="make" value="false" />
                          <ConfirmSubmitButton
                            confirmText={`Remove co-manager role from ${m.user.email ?? "this user"}?`}
                            className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
                          >
                            Make member
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <form action={setCoManagerAction} className="flex gap-2">
                          <input type="hidden" name="userId" value={m.userId} />
                          <input type="hidden" name="make" value="true" />
                          <ConfirmSubmitButton
                            confirmText={`Make ${m.user.email ?? "this user"} a co-manager?`}
                            className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-500/20"
                          >
                            Make co-manager
                          </ConfirmSubmitButton>
                        </form>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <h2 className="text-base font-semibold text-white">Draft tools</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Managers can undo the most recent pick if someone mis-clicked.
          </p>

          {draft?.status === "active" ? (
            lastPick ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    Last pick: #{(lastPick.pickNumber ?? 0) + 1}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {teamsByCode.get(lastPick.teamCode)?.name ?? lastPick.teamCode.toUpperCase()} ·
                    {" "}
                    {lastPick.user.name ?? lastPick.user.email ?? "Unknown manager"}
                  </div>
                </div>

                <form action={undoLastPickAction} className="flex gap-2">
                  <input type="hidden" name="leagueId" value={leagueId} />
                  <ConfirmSubmitButton
                    confirmText={`Undo the last pick (#${(lastPick.pickNumber ?? 0) + 1})?`}
                    className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-medium text-red-100 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20"
                  >
                    Undo last pick
                  </ConfirmSubmitButton>
                </form>
              </div>
            ) : (
              <div className="mt-4 text-sm text-zinc-300">No picks to undo yet.</div>
            )
          ) : (
            <div className="mt-4 text-sm text-zinc-300">Draft is not active.</div>
          )}
        </div>

        {allowBots ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
            <h2 className="text-base font-semibold text-white">Bot players</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Create bot accounts and add them to this league for testing.
            </p>
            <div className="mt-2 text-xs text-zinc-400">
              Current members: {members.length} · Bots: {botCount} · Bot password: {BOT_PASSWORD}
            </div>

            <form action={addBotsAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block w-full sm:max-w-[14rem]">
                <div className="text-xs font-medium text-zinc-300">Target members</div>
                <input
                  name="targetMembers"
                  type="number"
                  min={1}
                  max={64}
                  defaultValue={DEFAULT_TARGET_MEMBERS}
                  className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
                  required
                />
              </label>

              <ConfirmSubmitButton
                confirmText="Add bot players to this league?"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
              >
                Add bots
              </ConfirmSubmitButton>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
