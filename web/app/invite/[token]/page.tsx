import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InstallButton } from "@/components/InstallButton";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tournament = await prisma.tournament.findFirst({
    where: { inviteToken: token },
    select: { name: true, year: true },
  });
  if (!tournament) return { title: "Invalid invite" };
  return {
    title: `Join ${tournament.name} ${tournament.year} — WorldCuppy`,
    description: `You've been invited to join the ${tournament.name} ${tournament.year} fantasy draft on WorldCuppy!`,
    openGraph: {
      title: `Join ${tournament.name} ${tournament.year}`,
      description: `You've been invited to the fantasy draft!`,
      type: "website",
    },
  };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const tournament = await prisma.tournament.findFirst({
    where: { inviteToken: token },
    select: { id: true, name: true, year: true, type: true, status: true, draftDate: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Invalid invite link</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">This link may have expired or been regenerated.</p>
        <Link href="/dashboard" className="mt-6 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Go to dashboard →</Link>
      </main>
    );
  }

  const session = await getServerSession(authOptions);

  if (session) {
    let userId: string | undefined = session.user.id;
    if (!userId) {
      const email = session.user.email?.toLowerCase().trim();
      if (email) {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        userId = user?.id;
      }
    }
    if (userId) {
      await prisma.tournamentParticipant.upsert({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
        create: { tournamentId: tournament.id, userId },
        update: {},
      });
      redirect("/draft");
    }
  }

  // Not logged in — show landing page
  const draftLabel = tournament.draftDate
    ? tournament.draftDate.toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
        hour12: true, timeZoneName: "short",
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-6xl mb-6">⚽</div>

      <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
        You&apos;re invited
      </div>
      <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
        {tournament.name} {tournament.year}
      </h1>
      <p className="mt-3 text-zinc-500 dark:text-zinc-400">
        Join the fantasy draft and compete to pick the best teams.
      </p>

      {draftLabel && (
        <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-5 py-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Draft scheduled</div>
          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{draftLabel}</div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 w-full">
        <Link
          href={`/login?callbackUrl=/invite/${token}`}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Sign in to join
        </Link>
        <Link
          href={`/register?callbackUrl=/invite/${token}`}
          className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10"
        >
          Create an account
        </Link>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Install the app for the best experience</p>
        <InstallButton />
      </div>
    </main>
  );
}
