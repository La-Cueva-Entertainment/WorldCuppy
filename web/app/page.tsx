import Link from "next/link";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { TEAMS } from "@/lib/teams";

export default async function Home() {
  const session = await getServerSession(authOptions);

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
