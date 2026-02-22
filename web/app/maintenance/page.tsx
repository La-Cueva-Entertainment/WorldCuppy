import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams?:
    | { error?: string; notice?: string }
    | Promise<{ error?: string; notice?: string }>;
}) {
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isSiteOwner(session)) redirect("/dashboard?error=Forbidden");

  async function restoreLeagueAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (!isSiteOwner(session)) redirect("/dashboard?error=Forbidden");

    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/maintenance?error=Missing%20league");

    await prisma.league.update({
      where: { id: leagueId },
      data: { deletedAt: null },
    });

    redirect("/maintenance?notice=League%20restored");
  }

  async function permanentDeleteLeagueAction(formData: FormData) {
    "use server";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (!isSiteOwner(session)) redirect("/dashboard?error=Forbidden");

    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) redirect("/maintenance?error=Missing%20league");

    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, deletedAt: true },
    });

    if (!league) redirect("/maintenance?error=League%20not%20found");
    if (!league.deletedAt) {
      redirect("/maintenance?error=League%20must%20be%20deleted%20first");
    }

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { activeLeagueId: leagueId },
        data: { activeLeagueId: null },
      }),
      prisma.league.delete({ where: { id: leagueId } }),
    ]);

    redirect(
      `/maintenance?notice=${encodeURIComponent(`Permanently deleted ${league.name}`)}`,
    );
  }

  const deletedLeagues = await prisma.league.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true, name: true, deletedAt: true },
    orderBy: { deletedAt: "desc" },
    take: 50,
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Site maintenance
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              Site-owner tools only.
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

        {resolvedSearchParams?.notice ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 ring-1 ring-inset ring-emerald-500/20">
            {resolvedSearchParams.notice}
          </div>
        ) : null}

        <div className="mt-10 rounded-2xl border border-white/10 bg-zinc-950/40 p-6 ring-1 ring-inset ring-white/5 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">
              Deleted leagues
            </h2>
            <p className="mt-1 text-sm text-zinc-300">Latest 50.</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deletedLeagues.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300 ring-1 ring-inset ring-white/5">
                No deleted leagues.
              </div>
            ) : (
              deletedLeagues.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-inset ring-white/5"
                >
                  <div className="text-sm font-semibold text-white">{l.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Deleted {l.deletedAt?.toLocaleString()}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <form action={restoreLeagueAction}>
                      <input type="hidden" name="leagueId" value={l.id} />
                      <ConfirmSubmitButton
                        confirmText={`Restore "${l.name}"?`}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-50 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-500/20"
                      >
                        Restore league
                      </ConfirmSubmitButton>
                    </form>

                    <form action={permanentDeleteLeagueAction}>
                      <input type="hidden" name="leagueId" value={l.id} />
                      <ConfirmSubmitButton
                        confirmText={`Permanently delete "${l.name}"? This cannot be undone.`}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/15"
                      >
                        Permanent delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
