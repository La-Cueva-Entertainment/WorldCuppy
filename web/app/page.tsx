import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";

import TournamentView, { type TvPlayer, type TvMatch, type TvPayout } from "@/components/TournamentView";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { matchEarningsCents, totalEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";
import { MOCK_PLAYERS, MOCK_TODAY_MATCHES, MOCK_MATCHES_BY_STAGE } from "@/lib/mock-data";

void formatDollars; // imported for earnings calc, not used directly in JSX here

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="flex flex-col">
        <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 min-h-[360px] 2xl:min-h-[420px] flex items-end">
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-green-900/60 to-transparent" />
          <div className="relative z-10 flex flex-col justify-center px-[5vw] py-12 max-w-2xl 2xl:max-w-4xl">
            <h1 className="text-5xl font-extrabold tracking-tight text-white drop-shadow-lg md:text-6xl lg:text-7xl">
              World <span className="text-yellow-400">Cuppy</span>
            </h1>
            <p className="mt-3 text-lg text-white/80 drop-shadow lg:text-xl">
              International Fantasy Fútbol - Draft Nations
            </p>
          </div>
          <div className="absolute bottom-0 right-0 h-[300px] select-none pointer-events-none md:hidden">
            <Image src="/spain3.png" alt="Spain player" width={260} height={300}
              className="h-full w-auto object-contain object-bottom" priority />
          </div>
          <div className="absolute bottom-0 right-[2vw] h-[330px] 2xl:h-[390px] select-none pointer-events-none hidden md:block">
            <Image src="/swedish.png" alt="Sweden player" width={310} height={330}
              className="h-full w-auto object-contain object-bottom scale-x-[-1]" priority />
          </div>
          <div className="absolute bottom-0 right-[16vw] h-[345px] 2xl:h-[405px] select-none pointer-events-none hidden md:block">
            <Image src="/brazil6.png" alt="Brazil player" width={345} height={345}
              className="h-full w-auto object-contain object-bottom" priority />
          </div>
          <div className="absolute bottom-0 right-[28vw] h-[320px] 2xl:h-[380px] select-none pointer-events-none hidden md:block">
            <Image src="/ivory5.png" alt="Ivory Coast player" width={320} height={320}
              className="h-full w-auto object-contain object-bottom" priority />
          </div>
          <div className="absolute bottom-0 right-[43vw] h-[300px] 2xl:h-[360px] select-none pointer-events-none hidden md:block">
            <Image src="/belgian.png" alt="Belgium player" width={280} height={300}
              className="h-full w-auto object-contain object-bottom" priority />
          </div>
          <div className="absolute bottom-0 right-[52vw] h-[340px] 2xl:h-[400px] select-none pointer-events-none hidden md:block">
            <Image src="/spain3.png" alt="Spain player" width={320} height={340}
              className="h-full w-auto object-contain object-bottom" priority />
          </div>
        </div>

        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">
              🗓️ World Cup · Euros · Nations League
            </div>
            <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">
              🐍 Fair snake draft
            </div>
            <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-zinc-600 dark:text-zinc-300 shadow-sm">
              📊 Live standings & earnings
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/login" className="inline-flex h-12 items-center rounded-2xl bg-green-600 px-8 text-base font-bold text-white shadow-sm hover:bg-green-700">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex h-12 items-center rounded-2xl border border-zinc-200 dark:border-white/20 bg-white dark:bg-white/10 px-8 text-base font-semibold text-zinc-700 dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-white/20">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, draftDate: true },
  });

  if (!tournament) {
    const upcoming = await prisma.tournament.findFirst({
      where: { status: "upcoming" },
      orderBy: { createdAt: "desc" },
      select: { name: true, year: true, draftDate: true },
    });
    return (
      <TournamentView
        name={upcoming?.name ?? "FIFA World Cup"}
        year={upcoming?.year ?? 2026}
        isDemo={true}
        draftDateISO={upcoming?.draftDate?.toISOString() ?? null}
        players={MOCK_PLAYERS}
        todayMatches={MOCK_TODAY_MATCHES}
        matchesByStage={MOCK_MATCHES_BY_STAGE}
      />
    );
  }

  // ── Fetch all data ───────────────────────────────────────────────
  const [picks, playedMatches, users, adjustments] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamCode: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.earningsAdjustment.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, amountCents: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const playerIds = [...new Set(picks.map((p) => p.userId))].sort();

  const teamOwners = new Map<string, string[]>();
  const teamsByPlayer = new Map<string, Set<string>>();
  for (const p of picks) {
    const arr = teamOwners.get(p.teamCode) ?? [];
    arr.push(p.userId);
    teamOwners.set(p.teamCode, arr);
    const s = teamsByPlayer.get(p.userId) ?? new Set<string>();
    s.add(p.teamCode);
    teamsByPlayer.set(p.userId, s);
  }

  const matchResults: MatchResult[] = playedMatches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam, awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0, awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const ranked = playerIds
    .map((uid, i) => ({ uid, colorIdx: i, earnings: totalEarningsCents(matchResults, teamsByPlayer.get(uid) ?? new Set()) + adjustments.filter((a) => a.userId === uid).reduce((s, a) => s + a.amountCents, 0) }))
    .sort((a, b) => b.earnings - a.earnings);

  // ── Today's matches ──────────────────────────────────────────────
  const nowPST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const todayStart = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate(), 8, 0, 0));
  const todayEnd = new Date(Date.UTC(nowPST.getFullYear(), nowPST.getMonth(), nowPST.getDate() + 1, 8, 0, 0));
  const [todayDbMatches, allDbMatches] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: tournament.id, matchDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { matchDate: "asc" },
      select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
    }),
  ]);

  // ── Convert to TournamentView types ─────────────────────────────
  function ownerInfo(teamCode: string) {
    const ids = teamOwners.get(teamCode) ?? [];
    return {
      names: ids.map((id) => { const u = userById.get(id); return u?.name ?? u?.email?.split("@")[0] ?? "?"; }),
      colorIdx: ids.length > 0 ? playerIds.indexOf(ids[0]) : null,
    };
  }

  type DbMatch = typeof allDbMatches[0];
  function convertMatch(dbm: DbMatch, payouts?: TvPayout[]): TvMatch {
    const ho = ownerInfo(dbm.homeTeam);
    const ao = ownerInfo(dbm.awayTeam);
    return {
      id: dbm.id,
      stage: dbm.stage,
      groupName: dbm.groupName,
      homeTeam: dbm.homeTeam,
      homeTeamName: TEAMS_BY_CODE.get(dbm.homeTeam)?.name ?? dbm.homeTeam,
      awayTeam: dbm.awayTeam,
      awayTeamName: TEAMS_BY_CODE.get(dbm.awayTeam)?.name ?? dbm.awayTeam,
      homeScore: dbm.homeScore,
      awayScore: dbm.awayScore,
      penaltyWinner: dbm.penaltyWinner,
      played: dbm.played,
      matchDateISO: dbm.matchDate ? dbm.matchDate.toISOString() : null,
      venue: dbm.venue,
      payouts,
      homeOwnerNames: ho.names,
      homeOwnerColorIdx: ho.colorIdx,
      awayOwnerNames: ao.names,
      awayOwnerColorIdx: ao.colorIdx,
    };
  }

  const tvPlayers: TvPlayer[] = ranked.map((r) => {
    const user = userById.get(r.uid);
    const teams = [...(teamsByPlayer.get(r.uid) ?? [])].map((code) => ({
      code, name: TEAMS_BY_CODE.get(code)?.name ?? code,
    }));
    return { id: r.uid, name: user?.name ?? user?.email ?? r.uid.slice(0, 8), earnings: r.earnings, teams, colorIdx: r.colorIdx };
  });

  const tvTodayMatches: TvMatch[] = todayDbMatches.map((dbm) => {
    const mr: MatchResult = {
      stage: dbm.stage as MatchResult["stage"],
      tournamentType: tournament.type as MatchResult["tournamentType"],
      homeTeam: dbm.homeTeam, awayTeam: dbm.awayTeam,
      homeScore: dbm.homeScore ?? 0, awayScore: dbm.awayScore ?? 0,
      penaltyWinner: dbm.penaltyWinner ?? null,
    };
    const payouts: TvPayout[] = playerIds.flatMap((uid) => {
      const teams = teamsByPlayer.get(uid) ?? new Set<string>();
      const cents = matchEarningsCents(mr, teams.has(dbm.homeTeam), teams.has(dbm.awayTeam));
      if (cents === 0) return [];
      const u = userById.get(uid);
      return [{ playerId: uid, playerName: u?.name ?? u?.email?.split("@")[0] ?? "?", colorIdx: playerIds.indexOf(uid), cents }];
    });
    return convertMatch(dbm, payouts);
  });

  const tvMatchesByStage: Partial<Record<string, TvMatch[]>> = {};
  for (const dbm of allDbMatches) {
    const arr = tvMatchesByStage[dbm.stage] ?? [];
    arr.push(convertMatch(dbm));
    tvMatchesByStage[dbm.stage] = arr;
  }

  return (
    <TournamentView
      name={tournament.name}
      year={tournament.year}
      status={tournament.status}
      showLiveSync={tournament.status === "active"}
      players={tvPlayers}
      todayMatches={tvTodayMatches}
      matchesByStage={tvMatchesByStage}
    />
  );
}
