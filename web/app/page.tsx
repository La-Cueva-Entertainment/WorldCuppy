import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { InstallButton } from "@/components/InstallButton";
import { InlineInstallGuide } from "@/components/InlineInstallGuide";
import { LiveSync } from "@/components/LiveSync";
import RssFeed from "@/components/RssFeed";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage", r32: "Round of 32", r16: "Round of 16",
  qf: "Quarter Finals", sf: "Semi Finals", "3rd": "3rd Place", final: "Final",
};

const PLAYER_COLORS = [
  "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300",
  "bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300",
  "bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300",
  "bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300",
  "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  "bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300",
];

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="flex flex-col">

        {/* ── Mobile landing ── */}
        <div className="flex flex-col md:hidden px-6 pt-4 pb-12 space-y-8">

          {/* Headline */}
          <div className="flex flex-col items-center text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Pick teams.<br />Win money.
            </h2>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400 text-base max-w-xs">
              Draft real national teams,<br />track every match, compete.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-2xl bg-green-600 py-4 text-base font-bold text-white shadow-sm hover:bg-green-700"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="flex w-full items-center justify-center rounded-2xl border border-zinc-200 dark:border-white/15 bg-white dark:bg-white/8 py-4 text-base font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/12"
            >
              Create account
            </Link>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {[
              { icon: "🌍", title: "World Cup · Euros · Nations League", desc: "All major international tournaments" },
              { icon: "🐍", title: "Fair snake draft", desc: "Everyone gets a fair shot at the top teams" },
              { icon: "📊", title: "Live standings & earnings", desc: "Watch your money grow match by match" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl border border-zinc-100 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-4 py-3.5">
                <span className="text-2xl shrink-0">{icon}</span>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-white text-sm">{title}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Install */}
          <InlineInstallGuide />

        </div>

        {/* ── Desktop landing ── */}
        <div className="hidden md:flex flex-col">
          {/* Hero with players */}
          <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 min-h-[360px] 2xl:min-h-[420px] flex items-end">
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-900/60 to-transparent" />
            <div className="relative z-10 flex flex-col justify-center px-[5vw] py-12 max-w-2xl 2xl:max-w-4xl">
              <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-lg lg:text-7xl">
                World <span className="text-yellow-400">Cuppy</span>
              </h1>
              <p className="mt-3 text-lg text-white/80 drop-shadow lg:text-xl">
                International Fantasy Fútbol - Draft Nations
              </p>
            </div>
            <div className="absolute bottom-0 right-[2vw] h-[330px] 2xl:h-[390px] select-none pointer-events-none">
              <Image src="/swedish.png" alt="" width={310} height={330} className="h-full w-auto object-contain object-bottom scale-x-[-1]" priority />
            </div>
            <div className="absolute bottom-0 right-[16vw] h-[345px] 2xl:h-[405px] select-none pointer-events-none">
              <Image src="/brazil6.png" alt="" width={345} height={345} className="h-full w-auto object-contain object-bottom" priority />
            </div>
            <div className="absolute bottom-0 right-[28vw] h-[320px] 2xl:h-[380px] select-none pointer-events-none">
              <Image src="/ivory5.png" alt="" width={320} height={320} className="h-full w-auto object-contain object-bottom" priority />
            </div>
            <div className="absolute bottom-0 right-[43vw] h-[300px] 2xl:h-[360px] select-none pointer-events-none">
              <Image src="/belgian.png" alt="" width={280} height={300} className="h-full w-auto object-contain object-bottom" priority />
            </div>
            <div className="absolute bottom-0 right-[52vw] h-[340px] 2xl:h-[400px] select-none pointer-events-none">
              <Image src="/spain3.png" alt="" width={320} height={340} className="h-full w-auto object-contain object-bottom" priority />
            </div>
          </div>

          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">🗓️ World Cup · Euros · Nations League</div>
              <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">🐍 Fair snake draft</div>
              <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">📊 Live standings & earnings</div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/login" className="inline-flex h-12 items-center rounded-2xl bg-green-600 px-8 text-base font-bold text-white shadow-sm hover:bg-green-700">Sign in</Link>
              <Link href="/register" className="inline-flex h-12 items-center rounded-2xl border border-zinc-200 dark:border-white/20 bg-white dark:bg-white/10 px-8 text-base font-semibold text-zinc-700 dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-white/20">Create account</Link>
              <InstallButton />
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ── Fetch tournament data ─────────────────────────────────────────
  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["upcoming", "draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, draftDate: true },
  });

  // ── Today's matches ──────────────────────────────────────────────
  const nowPST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const todayStart = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate(), 8, 0, 0));
  const todayEnd = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate() + 1, 8, 0, 0));

  const [todayDbMatches, allPicks, users] = tournament
    ? await Promise.all([
        prisma.match.findMany({
          where: { tournamentId: tournament.id, matchDate: { gte: todayStart, lte: todayEnd } },
          orderBy: { matchDate: "asc" },
          select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
        }),
        prisma.lineupPick.findMany({
          where: { tournamentId: tournament.id },
          select: { userId: true, teamCode: true },
        }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      ])
    : [[], [], []];

  const userById = new Map(users.map((u: { id: string; name: string | null; email: string | null }) => [u.id, u]));
  const playerIds = [...new Set(allPicks.map((p: { userId: string; teamCode: string }) => p.userId))].sort();
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of allPicks) {
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  const showDraftCard = tournament && (tournament.status === "upcoming" || tournament.status === "draft");
  const showLiveSync = tournament?.status === "active";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex justify-end">
        <InstallButton />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="space-y-8 min-w-0">

          {/* Draft Card */}
          {showDraftCard && (
            <section className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                    {tournament.status === "draft" ? "Draft Open" : "Coming Up"}
                  </div>
                  <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                    {tournament.name} <span className="text-emerald-600 dark:text-emerald-400">{tournament.year}</span>
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {tournament.teamsPerPlayer} teams per player · snake draft
                  </p>
                </div>
                <Link
                  href="/draft"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  Open Draft →
                </Link>
              </div>

              {tournament.draftDate && (
                <div className="mt-5">
                  <CountdownTimer
                    targetISO={tournament.draftDate.toISOString()}
                    label={`${tournament.name} ${tournament.year} Draft`}
                  />
                </div>
              )}
            </section>
          )}

          {/* No tournament at all */}
          {!tournament && (
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-10 text-center">
              <div className="text-4xl mb-3">⚽</div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">No tournament yet</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                A tournament will appear here once it&apos;s created. Stay tuned!
              </p>
            </section>
          )}

          {/* Today's Matches */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Today&apos;s Matches
              </h2>
              {showLiveSync && <LiveSync />}
            </div>

            {todayDbMatches.length === 0 ? (
              <div className="rounded-2xl border border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 px-5 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                No matches scheduled for today.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {todayDbMatches.map((m) => {
                  const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                  const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
                  const kickoff = fmtTime(m.matchDate?.toISOString());

                  const mr: MatchResult = {
                    stage: m.stage as MatchResult["stage"],
                    tournamentType: (tournament?.type ?? "world_cup") as MatchResult["tournamentType"],
                    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
                    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
                    penaltyWinner: m.penaltyWinner ?? null,
                  };

                  const payouts = playerIds.flatMap((uid: string) => {
                    const teams = teamsByPlayer.get(uid) ?? new Set<string>();
                    const cents = matchEarningsCents(mr, teams.has(m.homeTeam), teams.has(m.awayTeam));
                    if (cents === 0) return [];
                    const u = userById.get(uid);
                    return [{ playerId: uid, playerName: u?.name ?? u?.email?.split("@")[0] ?? "?", colorIdx: playerIds.indexOf(uid), cents }];
                  });

                  return (
                    <div key={m.id} className={`rounded-2xl border p-4 ${
                      m.played
                        ? "border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5"
                        : "border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5"
                    }`}>
                      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <span>{STAGE_LABELS[m.stage] ?? m.stage}{m.groupName ? ` · Grp ${m.groupName}` : ""}</span>
                        {kickoff && !m.played && <span>{kickoff}</span>}
                        {m.played && <span className="text-emerald-600 dark:text-emerald-400">Final</span>}
                      </div>
                      {m.venue && !m.played && (
                        <div className="mb-2 text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{m.venue}</div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${m.played && !homeWon ? "opacity-50" : ""}`}>
                          <CountryFlag code={m.homeTeam} label={TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam} className="h-5 w-7 shrink-0" />
                          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{TEAMS_BY_CODE.get(m.homeTeam)?.name ?? m.homeTeam}</span>
                        </div>
                        <div className="shrink-0 text-center">
                          {m.played ? (
                            <span className="font-mono text-base font-bold text-zinc-900 dark:text-white">
                              {m.homeScore}<span className="text-zinc-400 dark:text-zinc-500"> – </span>{m.awayScore}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">vs</span>
                          )}
                          {m.penaltyWinner && <div className="text-[10px] text-amber-600 dark:text-amber-400">pens</div>}
                        </div>
                        <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-1.5 ${m.played && !awayWon ? "opacity-50" : ""}`}>
                          <CountryFlag code={m.awayTeam} label={TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam} className="h-5 w-7 shrink-0" />
                          <span className="truncate text-right text-sm font-semibold text-zinc-900 dark:text-white">{TEAMS_BY_CODE.get(m.awayTeam)?.name ?? m.awayTeam}</span>
                        </div>
                      </div>
                      {payouts.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 dark:border-white/5 pt-3">
                          {payouts.map((p) => (
                            <span key={p.playerId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length]}`}>
                              {p.playerName} +{formatDollars(p.cents)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RSS Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <RssFeed />
          </div>
        </aside>
      </div>

      {/* RSS on mobile (below main content) */}
      <div className="mt-8 lg:hidden">
        <RssFeed />
      </div>
    </main>
  );
}
