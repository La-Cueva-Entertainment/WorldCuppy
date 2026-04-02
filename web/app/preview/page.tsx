/**
 * /preview — Static mock of the dashboard with fake WC 2026 data.
 * No auth required, no DB queries. For demo purposes only.
 */

import { CountryFlag } from "@/components/CountryFlag";
import { formatDollars } from "@/lib/earnings";

const PLAYER_COLORS = [
  { light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", amount: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
  { light: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500",   amount: "text-amber-700",   badge: "bg-amber-100 text-amber-800" },
  { light: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-700",     dot: "bg-sky-500",     amount: "text-sky-700",     badge: "bg-sky-100 text-sky-800" },
  { light: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-700",    dot: "bg-rose-500",    amount: "text-rose-700",    badge: "bg-rose-100 text-rose-800" },
  { light: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  dot: "bg-purple-500",  amount: "text-purple-700",  badge: "bg-purple-100 text-purple-800" },
  { light: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-700",  dot: "bg-orange-500",  amount: "text-orange-700",  badge: "bg-orange-100 text-orange-800" },
  { light: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-700",    dot: "bg-cyan-500",    amount: "text-cyan-700",    badge: "bg-cyan-100 text-cyan-800" },
  { light: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-700", dot: "bg-fuchsia-500", amount: "text-fuchsia-700", badge: "bg-fuchsia-100 text-fuchsia-800" },
];

const STAGE_LABELS: Record<string, string> = {
  group: "Group Stage",
  r16:   "Round of 16",
  qf:    "Quarter Finals",
  sf:    "Semi Finals",
  "3rd": "3rd Place",
  final: "Final",
};

const PLAYERS = [
  { id: "1", name: "Angel" },
  { id: "2", name: "Joe" },
  { id: "3", name: "Anthony" },
  { id: "4", name: "Nico" },
  { id: "5", name: "Spencer" },
  { id: "6", name: "Ruben" },
  { id: "7", name: "Ricardo" },
  { id: "8", name: "Chris" },
];

const PICKS: Record<string, { code: string; name: string }[]> = {
  "1": [{ code: "br", name: "Brazil" },      { code: "pt", name: "Portugal" },    { code: "au", name: "Australia" }, { code: "ma", name: "Morocco" }],
  "2": [{ code: "ar", name: "Argentina" },   { code: "gb-eng", name: "England" }, { code: "co", name: "Colombia" },  { code: "sn", name: "Senegal" }],
  "3": [{ code: "fr", name: "France" },      { code: "jp", name: "Japan" },       { code: "mx", name: "Mexico" },    { code: "ng", name: "Nigeria" }],
  "4": [{ code: "es", name: "Spain" },       { code: "nl", name: "Netherlands" }, { code: "eg", name: "Egypt" },     { code: "ca", name: "Canada" }],
  "5": [{ code: "de", name: "Germany" },     { code: "us", name: "USA" },          { code: "gh", name: "Ghana" },     { code: "kr", name: "South Korea" }],
  "6": [{ code: "be", name: "Belgium" },     { code: "hr", name: "Croatia" },     { code: "ci", name: "Côte d'Ivoire" }, { code: "ec", name: "Ecuador" }],
  "7": [{ code: "it", name: "Italy" },       { code: "uy", name: "Uruguay" },     { code: "cm", name: "Cameroon" },  { code: "rs", name: "Serbia" }],
  "8": [{ code: "pt", name: "Portugal" },    { code: "dk", name: "Denmark" },     { code: "pe", name: "Peru" },      { code: "qa", name: "Qatar" }],
};

const STANDINGS = [
  { id: "3", earnings: 8475 },
  { id: "2", earnings: 6200 },
  { id: "4", earnings: 5950 },
  { id: "1", earnings: 4800 },
  { id: "6", earnings: 3725 },
  { id: "5", earnings: 3100 },
  { id: "8", earnings: 2450 },
  { id: "7", earnings: 1875 },
];

// team code → player id(s)
const TEAM_OWNERS: Record<string, string[]> = {
  fr: ["3"], es: ["4"], ar: ["2"], br: ["1"],
  "gb-eng": ["2"], nl: ["4"], de: ["5"], pt: ["1", "8"],
  be: ["6"], it: ["7"], hr: ["6"], uy: ["7"],
};

type MockMatch = {
  id: string; stage: string; groupName?: string;
  homeTeam: string; homeName: string;
  awayTeam: string; awayName: string;
  homeScore: number | null; awayScore: number | null;
  penaltyWinner: string | null; played: boolean;
};

const MATCHES: MockMatch[] = [
  // Group A
  { id: "g1", stage: "group", groupName: "A", homeTeam: "fr", homeName: "France",      awayTeam: "de",     awayName: "Germany",     homeScore: 2, awayScore: 1, penaltyWinner: null, played: true  },
  { id: "g2", stage: "group", groupName: "A", homeTeam: "ar", homeName: "Argentina",   awayTeam: "br",     awayName: "Brazil",      homeScore: 0, awayScore: 0, penaltyWinner: null, played: true  },
  // Group B
  { id: "g3", stage: "group", groupName: "B", homeTeam: "es", homeName: "Spain",       awayTeam: "gb-eng", awayName: "England",     homeScore: 3, awayScore: 1, penaltyWinner: null, played: true  },
  { id: "g4", stage: "group", groupName: "B", homeTeam: "nl", homeName: "Netherlands", awayTeam: "be",     awayName: "Belgium",     homeScore: 2, awayScore: 0, penaltyWinner: null, played: true  },
  // Group C
  { id: "g5", stage: "group", groupName: "C", homeTeam: "pt", homeName: "Portugal",    awayTeam: "it",     awayName: "Italy",       homeScore: 1, awayScore: 1, penaltyWinner: null, played: true  },
  { id: "g6", stage: "group", groupName: "C", homeTeam: "de", homeName: "Germany",     awayTeam: "hr",     awayName: "Croatia",     homeScore: 2, awayScore: 2, penaltyWinner: null, played: true  },
  // Group D
  { id: "g7", stage: "group", groupName: "D", homeTeam: "us", homeName: "USA",         awayTeam: "mx",     awayName: "Mexico",      homeScore: 4, awayScore: 2, penaltyWinner: null, played: true  },
  { id: "g8", stage: "group", groupName: "D", homeTeam: "br", homeName: "Brazil",      awayTeam: "co",     awayName: "Colombia",    homeScore: 3, awayScore: 0, penaltyWinner: null, played: true  },
  // R16
  { id: "r1", stage: "r16", homeTeam: "fr",     homeName: "France",      awayTeam: "nl",     awayName: "Netherlands", homeScore: 2, awayScore: 1, penaltyWinner: null,  played: true  },
  { id: "r2", stage: "r16", homeTeam: "es",     homeName: "Spain",       awayTeam: "ar",     awayName: "Argentina",   homeScore: 1, awayScore: 1, penaltyWinner: "es",  played: true  },
  { id: "r3", stage: "r16", homeTeam: "br",     homeName: "Brazil",      awayTeam: "pt",     awayName: "Portugal",    homeScore: 0, awayScore: 1, penaltyWinner: null,  played: true  },
  { id: "r4", stage: "r16", homeTeam: "gb-eng", homeName: "England",     awayTeam: "de",     awayName: "Germany",     homeScore: null, awayScore: null, penaltyWinner: null, played: false },
  // QF
  { id: "q1", stage: "qf", homeTeam: "fr", homeName: "France",   awayTeam: "es", awayName: "Spain",    homeScore: null, awayScore: null, penaltyWinner: null, played: false },
  { id: "q2", stage: "qf", homeTeam: "pt", homeName: "Portugal", awayTeam: "de", awayName: "Germany",  homeScore: null, awayScore: null, penaltyWinner: null, played: false },
  // SF
  { id: "s1", stage: "sf", homeTeam: "fr", homeName: "France",   awayTeam: "pt", awayName: "Portugal", homeScore: null, awayScore: null, penaltyWinner: null, played: false },
  // Final
  { id: "f1", stage: "final", homeTeam: "fr", homeName: "France", awayTeam: "es", awayName: "Spain", homeScore: null, awayScore: null, penaltyWinner: null, played: false },
];

type TodayMatch = {
  id: string; stage: string; groupName?: string;
  homeTeam: string; homeName: string;
  awayTeam: string; awayName: string;
  homeScore: number; awayScore: number;
  penaltyWinner: string | null;
  payouts: { playerId: string; name: string; cents: number }[];
};

const TODAY_MATCHES: TodayMatch[] = [
  {
    id: "t1", stage: "group", groupName: "A",
    homeTeam: "fr", homeName: "France", awayTeam: "de", awayName: "Germany",
    homeScore: 2, awayScore: 1, penaltyWinner: null,
    payouts: [{ playerId: "3", name: "Anthony", cents: 325 }],
  },
  {
    id: "t2", stage: "group", groupName: "B",
    homeTeam: "es", homeName: "Spain", awayTeam: "gb-eng", awayName: "England",
    homeScore: 3, awayScore: 1, penaltyWinner: null,
    payouts: [{ playerId: "4", name: "Nico", cents: 350 }],
  },
  {
    id: "t3", stage: "group", groupName: "D",
    homeTeam: "br", homeName: "Brazil", awayTeam: "co", awayName: "Colombia",
    homeScore: 3, awayScore: 0, penaltyWinner: null,
    payouts: [{ playerId: "1", name: "Angel", cents: 375 }],
  },
];

const STAGE_ORDER = ["qf", "sf", "3rd", "final"];

export default function PreviewPage() {
  const playerById = new Map(PLAYERS.map((p) => [p.id, p]));
  const colorByPlayerId = new Map(STANDINGS.map((s, i) => [s.id, PLAYER_COLORS[i % PLAYER_COLORS.length]]));

  const matchesByStage = new Map<string, MockMatch[]>();
  for (const s of STAGE_ORDER) matchesByStage.set(s, []);
  for (const m of MATCHES) {
    const arr = matchesByStage.get(m.stage) ?? [];
    arr.push(m);
    matchesByStage.set(m.stage, arr);
  }

  const getOwnerNames = (teamCode: string) =>
    (TEAM_OWNERS[teamCode] ?? [])
      .map((id) => playerById.get(id)?.name ?? "?")
      .join(" & ");

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">

      {/* Preview banner */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="text-base">👀</span>
        <span><strong>Preview mode</strong> — mock data showing what the dashboard looks like during World Cup 2026.</span>
      </div>

      {/* Tournament header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
          FIFA World Cup{" "}
          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-2xl font-extrabold text-emerald-700">2026</span>
        </h1>
        <p className="mt-1 text-sm font-medium text-emerald-600 uppercase tracking-wide">● Live</p>
      </div>

      {/* Today's Matches */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Today&apos;s Matches
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TODAY_MATCHES.map((m) => {
            const homeWon = m.homeScore > m.awayScore || m.penaltyWinner === m.homeTeam;
            const awayWon = m.awayScore > m.homeScore || m.penaltyWinner === m.awayTeam;
            return (
              <div key={m.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>{STAGE_LABELS[m.stage] ?? m.stage}{m.groupName ? ` · Grp ${m.groupName}` : ""}</span>
                  <span className="text-emerald-600">Final</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex min-w-0 flex-1 items-center gap-1.5 ${!homeWon ? "opacity-50" : ""}`}>
                    <CountryFlag code={m.homeTeam} label={m.homeName} className="h-5 w-7 shrink-0" />
                    <span className="truncate text-sm font-semibold text-zinc-900">{m.homeName}</span>
                  </div>
                  <div className="shrink-0 text-center">
                    <span className="font-mono text-base font-bold text-zinc-900">
                      {m.homeScore}<span className="text-zinc-400"> – </span>{m.awayScore}
                    </span>
                  </div>
                  <div className={`flex min-w-0 flex-1 flex-row-reverse items-center gap-1.5 ${!awayWon ? "opacity-50" : ""}`}>
                    <CountryFlag code={m.awayTeam} label={m.awayName} className="h-5 w-7 shrink-0" />
                    <span className="truncate text-right text-sm font-semibold text-zinc-900">{m.awayName}</span>
                  </div>
                </div>
                {m.payouts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
                    {m.payouts.map((p) => {
                      const c = colorByPlayerId.get(p.playerId);
                      return (
                        <span key={p.playerId} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${c?.badge ?? "bg-zinc-100 text-zinc-700"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c?.dot ?? "bg-zinc-400"}`} />
                          {p.name} +{formatDollars(p.cents)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">

        {/* ── Standings ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Standings</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-400">
                  <th className="py-3 pl-4 text-left font-medium w-8">#</th>
                  <th className="py-3 text-left font-medium">Player</th>
                  <th className="py-3 pr-4 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody>
                {STANDINGS.map((row, i) => {
                  const c = PLAYER_COLORS[i % PLAYER_COLORS.length];
                  const player = playerById.get(row.id);
                  const teams = PICKS[row.id] ?? [];
                  return (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                      <td className="py-3 pl-4 text-zinc-400 font-mono text-xs">{i + 1}</td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <span className="font-semibold text-zinc-900">{player?.name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pl-4">
                            {teams.map((t) => (
                              <span key={t.code} className={`flex min-w-0 items-center gap-1 overflow-hidden rounded-md border px-1.5 py-0.5 text-xs font-medium ${c.light} ${c.border} ${c.text}`}>
                                <CountryFlag code={t.code} label={t.name} className="h-3 w-4 shrink-0" />
                                <span className="truncate">{t.name}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold tabular-nums ${c.amount}`}>
                        {formatDollars(row.earnings)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Bracket ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Tournament Bracket</h2>
          <div className="space-y-6">
            {STAGE_ORDER.map((stage) => {
              const stageMatches = matchesByStage.get(stage) ?? [];
              if (stageMatches.length === 0) return null;
              return (
                <div key={stage}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-700">{STAGE_LABELS[stage] ?? stage}</h3>
                    <div className="h-px flex-1 bg-zinc-100" />
                  </div>
                  <div className={`grid gap-2 ${stage === "group" ? "sm:grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
                    {stageMatches.map((m) => {
                      const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
                      const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);
                      const homeOwner = getOwnerNames(m.homeTeam);
                      const awayOwner = getOwnerNames(m.awayTeam);
                      const homeColor = colorByPlayerId.get(TEAM_OWNERS[m.homeTeam]?.[0] ?? "");
                      const awayColor = colorByPlayerId.get(TEAM_OWNERS[m.awayTeam]?.[0] ?? "");

                      return (
                        <div
                          key={m.id}
                          className={`overflow-hidden rounded-xl border bg-white shadow-sm ${m.played ? "border-zinc-200" : "border-zinc-100 opacity-60"}`}
                        >
                          {m.groupName && (
                            <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                              Group {m.groupName}
                            </div>
                          )}
                          <div className="flex items-stretch">
                            {/* Home team */}
                            <div className={`flex flex-1 items-center gap-2.5 px-3 py-3 ${homeWon ? "" : m.played ? "opacity-50" : ""}`}>
                              <CountryFlag code={m.homeTeam} label={m.homeName} className="h-6 w-8 shrink-0 rounded shadow-sm" />
                              <div className="min-w-0">
                                <div className={`text-sm font-semibold ${homeWon ? "text-zinc-900" : "text-zinc-600"}`}>
                                  {m.homeName}
                                </div>
                                {homeOwner && (
                                  <div className={`text-[10px] font-medium ${homeColor ? homeColor.text : "text-zinc-400"}`}>
                                    {homeOwner}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Score */}
                            <div className="flex shrink-0 flex-col items-center justify-center border-x border-zinc-100 px-3">
                              {m.played ? (
                                <>
                                  <div className="flex items-center gap-2 font-mono text-lg font-bold leading-none">
                                    <span className={homeWon ? "text-zinc-900" : "text-zinc-400"}>{m.homeScore}</span>
                                    <span className="text-zinc-300">–</span>
                                    <span className={awayWon ? "text-zinc-900" : "text-zinc-400"}>{m.awayScore}</span>
                                  </div>
                                  {m.penaltyWinner && (
                                    <span className="mt-0.5 text-[10px] font-medium text-amber-600">pens</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs font-medium text-zinc-300">vs</span>
                              )}
                            </div>

                            {/* Away team */}
                            <div className={`flex flex-1 flex-row-reverse items-center gap-2.5 px-3 py-3 ${awayWon ? "" : m.played ? "opacity-50" : ""}`}>
                              <CountryFlag code={m.awayTeam} label={m.awayName} className="h-6 w-8 shrink-0 rounded shadow-sm" />
                              <div className="min-w-0 text-right">
                                <div className={`text-sm font-semibold ${awayWon ? "text-zinc-900" : "text-zinc-600"}`}>
                                  {m.awayName}
                                </div>
                                {awayOwner && (
                                  <div className={`text-[10px] font-medium ${awayColor ? awayColor.text : "text-zinc-400"}`}>
                                    {awayOwner}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
