import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
              Invites
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

function generateToken() {
  return randomBytes(24).toString("base64url");
}

function parseEmails(raw: string) {
  const parts = raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const unique = Array.from(new Set(parts));
  const valid = unique.filter((e) => /.+@.+\..+/.test(e));
  return valid;
}

export default async function LeagueInvitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams?: { error?: string };
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

  let membership: any = null;

  try {
    membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId,
          userId,
        },
      },
      include: { league: true },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref="/dashboard" />;
    }
    throw err;
  }

  if (!membership) redirect("/dashboard?error=League%20not%20found");
  if (membership.league.deletedAt) {
    redirect("/dashboard?error=That%20league%20was%20deleted");
  }
  if (membership.role !== "owner" && membership.role !== "co-manager") {
    redirect("/dashboard?error=Only%20managers%20can%20invite%20members");
  }

  async function createInviteAction(formData: FormData) {
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

    const league = await (async () => {
      try {
        return await prisma.league.findUnique({
          where: { id: leagueId },
          select: { deletedAt: true },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/invites?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (!league || league.deletedAt) {
      redirect("/dashboard?error=That%20league%20was%20deleted");
    }

    const ownerCheck = await (async () => {
      try {
        return await prisma.leagueMember.findUnique({
          where: {
            leagueId_userId: {
              leagueId,
              userId,
            },
          },
          select: { role: true },
        });
      } catch (err) {
        if (isMissingSchemaError(err)) {
          redirect(
            `/leagues/${leagueId}/invites?error=Database%20schema%20is%20out%20of%20date%20%E2%80%94%20run%20prisma%20migrate%20deploy`,
          );
        }
        throw err;
      }
    })();

    if (
      !ownerCheck ||
      (ownerCheck.role !== "owner" && ownerCheck.role !== "co-manager")
    ) {
      redirect("/dashboard?error=Only%20managers%20can%20invite%20members");
    }

    const raw = String(formData.get("emails") ?? "");
    const emails = parseEmails(raw);
    if (emails.length === 0) {
      redirect(`/leagues/${leagueId}/invites?error=Add%20one%20or%20more%20valid%20emails`);
    }

    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });

    const userIdByEmail = new Map(
      existingUsers.map((u) => [u.email?.toLowerCase() ?? "", u.id])
    );

    try {
      await prisma.$transaction([
        ...emails.map((email) => {
          const token = generateToken();
          const existingUserId = userIdByEmail.get(email);
          return prisma.leagueInvite.upsert({
            where: {
              leagueId_email: {
                leagueId,
                email,
              },
            },
            update: {
              token,
              acceptedAt: existingUserId ? new Date() : null,
              createdById: userId,
            },
            create: {
              leagueId,
              email,
              token,
              acceptedAt: existingUserId ? new Date() : null,
              createdById: userId,
            },
          });
        }),
        ...emails.flatMap((email) => {
          const existingUserId = userIdByEmail.get(email);
          if (!existingUserId) return [];
          return [
            prisma.leagueMember.upsert({
              where: {
                leagueId_userId: {
                  leagueId,
                  userId: existingUserId,
                },
              },
              update: {},
              create: {
                leagueId,
                userId: existingUserId,
                role: "member",
              },
            }),
            prisma.user.updateMany({
              where: {
                id: existingUserId,
                activeLeagueId: null,
              },
              data: { activeLeagueId: leagueId },
            }),
          ];
        }),
      ]);
    } catch {
      redirect(`/leagues/${leagueId}/invites?error=Could%20not%20create%20invites`);
    }

    redirect(`/leagues/${leagueId}/invites`);
  }

  let invites: Awaited<ReturnType<typeof prisma.leagueInvite.findMany>> = [];
  try {
    invites = await prisma.leagueInvite.findMany({
      where: { leagueId },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref={`/leagues/${leagueId}/settings`} />;
    }
    throw err;
  }

  let members: Array<{
    id: string;
    user: { id: string; email: string | null; name: string | null };
  }> = [];
  try {
    members = await prisma.leagueMember.findMany({
      where: { leagueId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return <SchemaOutOfDate backHref={`/leagues/${leagueId}/settings`} />;
    }
    throw err;
  }

  const memberEmails = new Set(
    members
      .map((m) => m.user.email?.toLowerCase())
      .filter((e): e is string => Boolean(e))
  );

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Invites
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              League: {membership.league.name}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-white/10"
          >
            Back
          </Link>
        </div>

        {searchParams?.error ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ring-1 ring-inset ring-red-500/20">
            {searchParams.error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <h2 className="text-base font-semibold text-white">Invite by email</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Paste one or many emails (comma or new line separated). Existing
            users get added immediately; new emails can sign up later.
          </p>

          <form action={createInviteAction} className="mt-4 grid gap-3">
            <textarea
              name="emails"
              rows={4}
              placeholder={`name1@example.com\nname2@example.com`}
              className="min-h-[104px] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500/40"
              required
            />
            <button
              type="submit"
              className="h-11 w-full rounded-xl bg-emerald-500/20 px-4 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
            >
              Add to invite list
            </button>
          </form>
        </div>

        <div className="mt-8">
          <h2 className="text-base font-semibold tracking-tight text-white">Invites</h2>
          <p className="mt-1 text-sm text-zinc-300">Pending and accepted invites.</p>

          <div className="mt-4 grid gap-3">
            {invites.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
                No invites yet.
              </div>
            ) : (
              invites.map((inv) => {
                const joined = memberEmails.has(inv.email.toLowerCase());
                const status = joined
                  ? "Joined"
                  : inv.acceptedAt
                    ? "Accepted"
                    : "Pending";

                return (
                  <div
                    key={inv.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {inv.email}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">{status}</div>
                      </div>
                      <Link
                        href={`/invite/${inv.token}`}
                        className="rounded-xl bg-zinc-950/40 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10 hover:bg-zinc-950/60"
                      >
                        Invite link
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-base font-semibold tracking-tight text-white">Members</h2>
          <p className="mt-1 text-sm text-zinc-300">Confirmed joined users.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
                No members yet.
              </div>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5"
                >
                  <div className="text-sm font-semibold text-white">
                    {m.user.name ?? m.user.email ?? "Unknown"}
                  </div>
                  {m.user.email ? (
                    <div className="mt-1 text-xs text-zinc-400">{m.user.email}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
