import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import TournamentView from "@/components/TournamentView";
import { CountryFlag } from "@/components/CountryFlag";
import { PreviewSelector } from "@/components/PreviewSelector";
import ProfileContent from "@/components/ProfileContent";
import TieredTeamsBox from "@/components/TieredTeamsBox";
import RssFeed from "@/components/RssFeed";
import { NewsImage } from "@/components/NewsImage";
import { authOptions } from "@/lib/auth";
import { isSiteOwner } from "@/lib/siteOwner";
import { prisma } from "@/lib/prisma";
import { matchEarningsCents, type MatchResult } from "@/lib/earnings";
import { buildDraftTiers } from "@/lib/draftTiers";
import { fetchRss, fmtRelTime } from "@/lib/rss";
import type { TvMatch, TvPlayer } from "@/components/TournamentView";
import {
  MOCK_PLAYERS, MOCK_TODAY_MATCHES, MOCK_MATCHES_BY_STAGE,
  MOCK_PROFILE_PROPS,
  MOCK_DRAFT_TAKEN_CODES, MOCK_DRAFT_TAKEN_BY,
  MOCK_DRAFT_MY_TEAMS, MOCK_DRAFT_ORDER, MOCK_DRAFT_CURRENT_PICKER,
  MOCK_DRAFT_ROUND, MOCK_DRAFT_PICK_IN_ROUND, MOCK_DRAFT_PLAYER_COUNT,
} from "@/lib/mock-data";

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

// These must match TieredTeamsBox's OWNER_BADGE_STYLES order
const DRAFT_BADGE_CLASSES = [
  "bg-rose-500/10 ring-rose-500/30 text-rose-800 dark:text-rose-200",
  "bg-amber-500/10 ring-amber-500/30 text-amber-800 dark:text-amber-200",
  "bg-lime-500/10 ring-lime-500/30 text-lime-800 dark:text-lime-200",
  "bg-emerald-500/10 ring-emerald-500/30 text-emerald-800 dark:text-emerald-200",
  "bg-cyan-500/10 ring-cyan-500/30 text-cyan-800 dark:text-cyan-200",
  "bg-sky-500/10 ring-sky-500/30 text-sky-800 dark:text-sky-200",
  "bg-indigo-500/10 ring-indigo-500/30 text-indigo-800 dark:text-indigo-200",
  "bg-fuchsia-500/10 ring-fuchsia-500/30 text-fuchsia-800 dark:text-fuchsia-200",
];

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });
}

const VALID_VIEWS = ["home", "standings", "draft", "profile", "login", "register", "news"] as const;
type PreviewView = typeof VALID_VIEWS[number];

export default async function PreviewPage({
  searchParams,
}: {
  searchParams?: { view?: string } | Promise<{ view?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let isAdmin = isSiteOwner(session);
  if (!isAdmin) {
    let userId: string | undefined = session.user.id;
    if (!userId) {
      const email = session.user.email?.toLowerCase().trim();
      if (email) {
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isAdmin: true } });
        userId = user?.id;
        isAdmin = user?.isAdmin ?? false;
      }
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      isAdmin = user?.isAdmin ?? false;
    }
  }

  if (!isAdmin) redirect("/");

  const resolved = searchParams ? await Promise.resolve(searchParams) : {};
  const rawView = resolved.view ?? "home";
  const view: PreviewView = (VALID_VIEWS as readonly string[]).includes(rawView)
    ? rawView as PreviewView
    : "home";

  // For news view: fetch real RSS articles
  let newsItems: Awaited<ReturnType<typeof fetchRss>> = [];
  if (view === "news") {
    newsItems = await fetchRss(7);
  }

  // For home view: pull real today's matches from the active tournament (falls back to mock)
  let liveTodayMatches: TvMatch[] | null = null;
  let livePlayers: TvPlayer[] | null = null;

  if (view === "home") {
    const activeTournament = await prisma.tournament.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true },
    });
    if (activeTournament) {
      const nowPST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const todayStart = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate(), 8, 0, 0));
      const todayEnd = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate() + 1, 8, 0, 0));

      const [dbMatches, allPicks, dbUsers] = await Promise.all([
        prisma.match.findMany({
          where: { tournamentId: activeTournament.id, matchDate: { gte: todayStart, lte: todayEnd } },
          orderBy: { matchDate: "asc" },
          select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true },
        }),
        prisma.lineupPick.findMany({ where: { tournamentId: activeTournament.id }, select: { userId: true, teamCode: true } }),
        prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      ]);

      const userById = new Map(dbUsers.map((u: { id: string; name: string | null; email: string | null }) => [u.id, u]));
      const playerIds = [...new Set(allPicks.map((p: { userId: string }) => p.userId))].sort();
      const teamsByPlayer = new Map<string, Set<string>>();
      for (const p of allPicks as { userId: string; teamCode: string }[]) {
        const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
        s.add(p.teamCode);
        teamsByPlayer.set(p.userId, s);
      }

      liveTodayMatches = (dbMatches as { id: string; stage: string; groupName: string | null; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; penaltyWinner: string | null; played: boolean; matchDate: Date | null }[]).map((m) => {
        const mr: MatchResult = {
          stage: m.stage as MatchResult["stage"],
          tournamentType: (activeTournament.type ?? "world_cup") as MatchResult["tournamentType"],
          homeTeam: m.homeTeam, awayTeam: m.awayTeam,
          homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
          penaltyWinner: m.penaltyWinner ?? null,
        };
        const payouts = playerIds.flatMap((uid: string) => {
          const teams = teamsByPlayer.get(uid) ?? new Set<string>();
          const cents = matchEarningsCents(mr, teams.has(m.homeTeam), teams.has(m.awayTeam));
          if (cents === 0) return [];
          const u = userById.get(uid) as { name: string | null; email: string | null } | undefined;
          return [{ playerId: uid, playerName: u?.name ?? u?.email?.split("@")[0] ?? "?", colorIdx: playerIds.indexOf(uid), cents }];
        });
        return {
          id: m.id, stage: m.stage, groupName: m.groupName,
          homeTeam: m.homeTeam, homeTeamName: m.homeTeam.toUpperCase(),
          awayTeam: m.awayTeam, awayTeamName: m.awayTeam.toUpperCase(),
          homeScore: m.homeScore, awayScore: m.awayScore,
          penaltyWinner: m.penaltyWinner, played: m.played,
          matchDateISO: m.matchDate?.toISOString() ?? null,
          payouts,
          homeOwnerNames: [], awayOwnerNames: [],
          homeOwnerColorIdx: null, awayOwnerColorIdx: null,
        } satisfies TvMatch;
      });

      // Build players from picks for the live standings sidebar
      const playerEarnings = new Map<string, number>();
      const playerTeams = new Map<string, string[]>();
      for (const p of allPicks as { userId: string; teamCode: string }[]) {
        if (!playerTeams.has(p.userId)) playerTeams.set(p.userId, []);
        playerTeams.get(p.userId)!.push(p.teamCode);
      }
      livePlayers = playerIds.map((uid, idx) => {
        const u = userById.get(uid) as { name: string | null; email: string | null } | undefined;
        return {
          id: uid,
          name: u?.name ?? u?.email?.split("@")[0] ?? "?",
          earnings: playerEarnings.get(uid) ?? 0,
          colorIdx: idx,
          teams: (playerTeams.get(uid) ?? []).map((code) => ({ code, name: code.toUpperCase() })),
        };
      });
    }
  }

  const homeIsLive = liveTodayMatches !== null;
  const todayMatchesToShow = liveTodayMatches ?? MOCK_TODAY_MATCHES;

  return (
    <div>
      {/* Preview control bar */}
      <div className="sticky top-[60px] z-20 flex items-center gap-4 border-b border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-6 py-2.5">
        <PreviewSelector currentView={view} />
        <span className="ml-auto text-[11px] text-amber-600 dark:text-amber-500">
          {view === "home" && homeIsLive ? "Live data (home)" : "Mock data"} — admin only
        </span>
      </div>

      {view === "standings" && (
        <TournamentView
          name="FIFA World Cup"
          year={2026}
          isDemo={true}
          showTodayMatches={false}
          todayMatches={[]}
          players={MOCK_PLAYERS}
          matchesByStage={MOCK_MATCHES_BY_STAGE}
        />
      )}

      {view === "home" && (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-8 min-w-0">

              {/* Mock Draft Card */}
              <section className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">
                      Draft Open
                    </div>
                    <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
                      FIFA World Cup <span className="text-emerald-600 dark:text-emerald-400">2026</span>
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      4 teams per player · snake draft
                    </p>
                  </div>
                  <Link
                    href="/preview?view=draft"
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Open Draft →
                  </Link>
                </div>
              </section>

              {/* Mock Today's Matches */}
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    Today&apos;s Matches
                  </h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {todayMatchesToShow.map((m) => {
                    const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                    const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
                    const kickoff = fmtTime(m.matchDateISO);
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
                        <div className="flex items-center gap-2">
                          <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${m.played && !homeWon ? "opacity-50" : ""}`}>
                            <CountryFlag code={m.homeTeam} label={m.homeTeamName} className="h-5 w-7 shrink-0" />
                            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{m.homeTeamName}</span>
                          </div>
                          <div className="shrink-0 text-center">
                            {m.played ? (
                              <span className="font-mono text-base font-bold text-zinc-900 dark:text-white">
                                {m.homeScore}<span className="text-zinc-400 dark:text-zinc-500"> – </span>{m.awayScore}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400 dark:text-zinc-500">vs</span>
                            )}
                          </div>
                          <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-1.5 ${m.played && !awayWon ? "opacity-50" : ""}`}>
                            <CountryFlag code={m.awayTeam} label={m.awayTeamName} className="h-5 w-7 shrink-0" />
                            <span className="truncate text-right text-sm font-semibold text-zinc-900 dark:text-white">{m.awayTeamName}</span>
                          </div>
                        </div>
                        {m.payouts && m.payouts.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 dark:border-white/5 pt-3">
                            {m.payouts.map((p) => (
                              <span key={p.playerId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length]}`}>
                                {p.playerName} +${(p.cents / 100).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* RSS Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-32">
                <RssFeed newsHref="/preview?view=news" />
              </div>
            </aside>
          </div>
        </main>
      )}

      {view === "draft" && (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
                Draft — <span className="text-green-600 dark:text-green-400">FIFA World Cup 2026</span>
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">4 teams per player · snake draft</p>
            </div>
          </div>

          {/* Draft status bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-0.5">Now Picking</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white">{MOCK_DRAFT_CURRENT_PICKER}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Round {MOCK_DRAFT_ROUND} · Pick {MOCK_DRAFT_PICK_IN_ROUND} of {MOCK_DRAFT_PLAYER_COUNT}
              </div>
            </div>
          </div>

          {/* Draft order badges */}
          <div className="mb-6 flex flex-wrap gap-2">
            {MOCK_DRAFT_ORDER.map((player) => {
              const cls = DRAFT_BADGE_CLASSES[player.colorIndex % DRAFT_BADGE_CLASSES.length];
              return (
                <div
                  key={player.name}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls} ${player.isCurrent ? "animate-pulse" : ""}`}
                >
                  {player.name} ({player.picks}/4)
                </div>
              );
            })}
          </div>

          {/* Team picker board */}
          <TieredTeamsBox
            tiers={buildDraftTiers("preview")}
            takenTeamCodes={MOCK_DRAFT_TAKEN_CODES}
            myTeamCodes={MOCK_DRAFT_MY_TEAMS}
            takenBy={MOCK_DRAFT_TAKEN_BY}
            canDraft={false}
            canPickNow={false}
            picksCount={MOCK_DRAFT_MY_TEAMS.length}
            lineupSize={4}
            showDraftControls={false}
            showRanks={false}
          />
        </main>
      )}

      {view === "profile" && (
        <ProfileContent {...MOCK_PROFILE_PROPS} draftHref="/preview?view=draft" disableTournamentLinks />
      )}

      {view === "login" && (
        <div className="min-h-[calc(100vh-120px)]">
          <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Sign in</h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Continue with Google, or use email/password.</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
                  <input type="email" disabled placeholder="you@example.com"
                    className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
                  <input type="password" disabled placeholder="••••••••"
                    className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                </label>
                <button disabled className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white opacity-70">
                  Sign in with email
                </button>
              </div>
              <div className="my-5 border-t border-zinc-200 dark:border-white/10" />
              <button disabled className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-900 dark:text-white opacity-70">
                <GoogleG className="h-5 w-5" />
                Sign in with Google
              </button>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">New here?</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create an account with email/password.</p>
              <div className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white">
                Create account
              </div>
            </div>
          </main>
        </div>
      )}

      {view === "news" && (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/preview?view=home"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/10"
            >
              ← Home
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">World Cup News</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Last 7 days · Fox Sports</p>
            </div>
          </div>
          {newsItems.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">No recent articles found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {newsItems.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-white/10"
                >
                  {item.imageUrl && (
                    <NewsImage src={item.imageUrl} alt="" className="h-24 w-36 shrink-0 rounded-xl object-cover bg-zinc-100 dark:bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-zinc-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1.5 text-sm leading-snug text-zinc-500 dark:text-zinc-400 line-clamp-3">{item.description}</p>
                    )}
                    <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">{fmtRelTime(item.pubDate)} · Fox Sports</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </main>
      )}

      {view === "register" && (
        <div className="min-h-[calc(100vh-120px)]">
          <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Create account</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Create an email/password account.</p>
              </div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Sign in</span>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</span>
                  <input type="text" disabled placeholder="Your name"
                    className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
                  <input type="email" disabled placeholder="you@example.com"
                    className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
                  <input type="password" disabled placeholder="••••••••"
                    className="h-11 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500" />
                </label>
                <button disabled className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white opacity-70">
                  Create account
                </button>
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.61l6.9-6.9C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l8.03 6.24C12.5 13.5 17.77 9.5 24 9.5z"/>
      <path fill="#34A853" d="M46.5 24.5c0-1.62-.15-3.17-.43-4.67H24v9.02h12.67c-.55 2.96-2.2 5.47-4.7 7.16l7.2 5.59C43.23 37.43 46.5 31.52 46.5 24.5z"/>
      <path fill="#4A90E2" d="M10.59 28.46A14.5 14.5 0 0 1 9.5 24c0-1.55.27-3.04.76-4.46l-8.03-6.24A23.93 23.93 0 0 0 0 24c0 3.9.94 7.59 2.6 10.85l7.99-6.39z"/>
      <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.14 15.91-5.82l-7.2-5.59c-2.02 1.36-4.6 2.16-8.71 2.16-6.23 0-11.5-4-13.41-9.54l-7.99 6.39C6.53 42.55 14.64 48 24 48z"/>
    </svg>
  );
}
