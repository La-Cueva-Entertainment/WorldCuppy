import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const email = session.user.email?.toLowerCase().trim();
  if (!email) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-lg px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
            <h1 className="text-xl font-semibold text-white">
              Can’t accept invite
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Your account doesn’t have an email address.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Go to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = user?.id;
  }

  if (!userId) redirect("/login");

  const invite = await prisma.leagueInvite.findUnique({
    where: { token },
    include: { league: { select: { deletedAt: true } } },
  });
  if (!invite) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-lg px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
            <h1 className="text-xl font-semibold text-white">Invite not found</h1>
            <p className="mt-2 text-sm text-zinc-300">
              This invite link is invalid.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Go to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (invite.league.deletedAt) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-lg px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
            <h1 className="text-xl font-semibold text-white">
              Can’t accept invite
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              This league was deleted.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
              Go to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (invite.email.toLowerCase() !== email) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto w-full max-w-lg px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
            <h1 className="text-xl font-semibold text-white">
              Wrong account
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              This invite was created for <span className="font-semibold">{invite.email}</span>.
              You are signed in as <span className="font-semibold">{email}</span>.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/dashboard"
                className="inline-flex rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-white/10 hover:bg-white/10"
              >
                Dashboard
              </Link>
              <Link
                href="/login"
                className="inline-flex rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25"
              >
                Sign in differently
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: {
        leagueId: invite.leagueId,
        userId,
      },
    },
    update: {},
    create: {
      leagueId: invite.leagueId,
      userId,
      role: "member",
    },
  });

  if (!invite.acceptedAt) {
    await prisma.leagueInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }

  await prisma.user.updateMany({
    where: {
      id: userId,
      activeLeagueId: null,
    },
    data: { activeLeagueId: invite.leagueId },
  });

  redirect("/dashboard");
}
