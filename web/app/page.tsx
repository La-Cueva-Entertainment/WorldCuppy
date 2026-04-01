import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  // Count registered players for the teaser
  const playerCount = await prisma.user.count().catch(() => 0);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 text-6xl">⚽</div>

      <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
        World{" "}
        <span className="bg-gradient-to-r from-green-400 to-yellow-300 bg-clip-text text-transparent">
          Cuppy
        </span>
      </h1>

      <p className="mt-4 max-w-lg text-lg text-zinc-300">
        Draft 4 nations. Earn real money for wins, goals, and upsets.
        Follow the bracket live with your friends.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
        <div className="rounded-full bg-white/5 px-4 py-2 text-zinc-200 ring-1 ring-white/10">
          🏆 4 teams per player
        </div>
        <div className="rounded-full bg-white/5 px-4 py-2 text-zinc-200 ring-1 ring-white/10">
          🐍 Snake draft
        </div>
        <div className="rounded-full bg-white/5 px-4 py-2 text-zinc-200 ring-1 ring-white/10">
          💰 Live earnings
        </div>
        {playerCount > 0 && (
          <div className="rounded-full bg-green-500/15 px-4 py-2 text-green-300 ring-1 ring-green-500/30">
            {playerCount} players registered
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="inline-flex h-12 items-center rounded-2xl bg-green-500 px-8 text-base font-bold text-white shadow-lg shadow-green-500/30 hover:bg-green-400"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="inline-flex h-12 items-center rounded-2xl bg-white/10 px-8 text-base font-semibold text-white ring-1 ring-white/20 hover:bg-white/15"
        >
          Create account
        </Link>
      </div>

      {/* Scoring cheat-sheet */}
      <div className="mt-16 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">How you earn</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            { stage: "Group Win", earn: "$3 + $0.25/gd" },
            { stage: "Group Tie", earn: "$1.00" },
            { stage: "Round of 16 Win", earn: "$5 + $0.50/gd" },
            { stage: "Quarter Final", earn: "$10 + $1/gd" },
            { stage: "Semi Final", earn: "$15 + $2/gd" },
            { stage: "3rd Place Win", earn: "$10 + $3/gd" },
            { stage: "Runner-up", earn: "$10 + $3/goal" },
            { stage: "Champion", earn: "$20 + $3/goal" },
            { stage: "Odds 2-jump", earn: "+$1 bonus" },
            { stage: "Odds 3-jump", earn: "+$2 bonus" },
          ].map(({ stage, earn }) => (
            <div key={stage} className="flex justify-between rounded-xl bg-black/20 px-3 py-2">
              <span className="text-zinc-300">{stage}</span>
              <span className="font-semibold text-green-400">{earn}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-7xl px-6 py-14">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/40 p-8 ring-1 ring-inset ring-white/5 backdrop-blur md:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/0 to-transparent" />
            <div className="absolute -top-52 left-[-16rem] h-96 w-[54rem] rounded-full bg-sky-500/12 blur-3xl" />
            <div className="absolute -top-60 right-[-18rem] h-[26rem] w-[56rem] rounded-full bg-indigo-500/10 blur-3xl" />

            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-500/15" />
          </div>
          <div className="max-w-2xl 2xl:max-w-3xl">
            <p className="text-sm font-medium text-sky-200/80">World Cuppy</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              8 Teams. Snake Draft. Global Glory.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              Draft 8 nations before kickoff in a snake draft. If multiple
              players own the same team, points split automatically.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10">
                8 picks
              </span>
              <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10">
                Shared ownership
              </span>
              <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 ring-1 ring-inset ring-white/10">
                Tournament points
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {TEAMS.slice(0, 6).map((t) => (
                <CountryFlag
                  key={t.code}
                  code={t.code}
                  label={t.name}
                  className="h-5 w-7"
                />
              ))}
              <span className="text-xs text-zinc-400">and more…</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {session ? (
                <Link
                  href="/dashboard"
                  className="rounded-full bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-sky-500/15 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-emerald-500/25 hover:from-emerald-500/30 hover:to-sky-500/20"
                >
                  Go to dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-sky-500/15 px-5 py-2.5 text-sm font-medium text-white ring-1 ring-inset ring-emerald-500/25 hover:from-emerald-500/30 hover:to-sky-500/20"
                >
                  Get started
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-semibold text-white">Draft your nations</div>
            <p className="mt-2 text-sm text-zinc-300">
              Lock in 8 teams before the tournament starts.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-semibold text-white">Market dynamics</div>
            <p className="mt-2 text-sm text-zinc-300">
              Use your draft pick wisely — shared teams split points.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 ring-1 ring-inset ring-white/5">
            <div className="text-sm font-semibold text-white">Claim global glory</div>
            <p className="mt-2 text-sm text-zinc-300">
              Rack up points across the tournament — and chase the top spot.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
