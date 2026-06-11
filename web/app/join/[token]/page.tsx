import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

export default async function JoinPage({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}) {
  const { token } = await Promise.resolve(params);

  const tournament = await prisma.tournament.findUnique({
    where: { inviteToken: token },
    select: { name: true, year: true, type: true, poolName: true, status: true },
  });

  if (!tournament) notFound();

  const displayName = tournament.poolName ?? `${tournament.name} ${tournament.year}`;
  const subtitle = tournament.poolName ? `${tournament.name} ${tournament.year}` : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
          ⚽
        </div>

        <div>
          <p className="text-sm font-medium text-emerald-600">You&apos;ve been invited to join</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{displayName}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
          <p className="mt-3 text-sm text-zinc-500 capitalize">
            {tournament.type.replace(/_/g, " ")} · {tournament.status}
          </p>
        </div>

        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-3">
            <Link
              href={`/register?invite=${token}`}
              className="flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Create account &amp; join
            </Link>
            <Link
              href={`/login?callbackUrl=/dashboard`}
              className="flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Sign in to existing account
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Already have an account? Sign in and you&apos;ll be ready to draft once the pool opens.
          </p>
        </div>
      </main>
    </div>
  );
}
