import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountryFlag } from "@/components/CountryFlag";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { totalEarningsCents, formatDollars, type MatchResult } from "@/lib/earnings";
import Link from "next/link";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export default async function LineupPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }
  if (!userId) redirect("/login");

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, type: true, teamsPerPlayer: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white">No active tournament</h1>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-green-400 hover:underline">Dashboard →</Link>
      </main>
    );
  }

  const [myPicks, matches] = await Promise.all([
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id, userId },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { teamCode: true, pickNumber: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id, played: true },
      select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true },
    }),
  ]);

  const myTeamCodes = new Set(myPicks.map((p) => p.teamCode));
  const matchResults: MatchResult[] = matches.map((m) => ({
    stage: m.stage as MatchResult["stage"],
    tournamentType: tournament.type as MatchResult["tournamentType"],
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    penaltyWinner: m.penaltyWinner ?? null,
  }));

  const totalEarned = totalEarningsCents(matchResults, myTeamCodes);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My Lineup</h1>
          <p className="mt-1 text-sm text-slate-500">{tournament.name} {tournament.year}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-right">
          <div className="text-xs text-slate-500">Total earned</div>
          <div className="text-xl font-bold text-green-700">{formatDollars(totalEarned)}</div>
        </div>
      </div>

      {myPicks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-500">You haven't drafted any teams yet.</p>
          <Link href="/draft" className="mt-3 inline-block text-sm text-green-600 hover:underline">Go to draft →</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myPicks.map((pick) => {
            const team = TEAMS_BY_CODE.get(pick.teamCode);
            const teamMatches = matchResults.filter(
              (m) => m.homeTeam === pick.teamCode || m.awayTeam === pick.teamCode,
            );
            const earned = totalEarningsCents(teamMatches, new Set([pick.teamCode]));
            return (
              <div key={pick.teamCode} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <CountryFlag code={pick.teamCode} label={team?.name ?? pick.teamCode} className="h-8 w-11" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{team?.name ?? pick.teamCode}</div>
                    <div className="text-xs text-slate-400">FIFA rank #{team?.rank} · Group {team?.group}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">earned</div>
                    <div className="font-bold text-green-700">{formatDollars(earned)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payout cheat-sheet */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">How you earn</h2>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            { stage: "Group Win",   earn: "$3 + $0.25/gd" },
            { stage: "Group Tie",   earn: "$1.00" },
            { stage: "R16 Win",     earn: "$5 + $0.50/gd" },
            { stage: "Quarter Final", earn: "$10 + $1/gd" },
            { stage: "Semi Final",  earn: "$15 + $2/gd" },
            { stage: "3rd Place",   earn: "$10 + $3/gd" },
            { stage: "Runner-up",   earn: "$10 + $3/goal" },
            { stage: "Champion",    earn: "$20 + $3/goal" },
            { stage: "Odds 2-jump", earn: "+$1 bonus" },
            { stage: "Odds 3-jump", earn: "+$2 bonus" },
          ].map(({ stage, earn }) => (
            <div key={stage} className="flex justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-slate-600">{stage}</span>
              <span className="font-semibold text-green-700">{earn}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
