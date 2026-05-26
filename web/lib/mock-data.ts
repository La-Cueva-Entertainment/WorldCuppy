import type { TvPlayer, TvMatch, TvPayout } from "@/components/TournamentView";

const OWNERS: Record<string, { names: string[]; colorIdx: number }> = {
  fr: { names: ["Anthony"], colorIdx: 0 },
  ar: { names: ["Joe"],     colorIdx: 1 },
  es: { names: ["Nico"],    colorIdx: 2 },
  br: { names: ["Angel"],   colorIdx: 3 },
  be: { names: ["Ruben"],   colorIdx: 4 },
  de: { names: ["Spencer"], colorIdx: 5 },
  it: { names: ["Ricardo"], colorIdx: 7 },
  pt: { names: ["Angel", "Chris"], colorIdx: 3 },
  "gb-eng": { names: ["Joe"],   colorIdx: 1 },
  nl:       { names: ["Nico"],  colorIdx: 2 },
  hr:       { names: ["Ruben"], colorIdx: 4 },
  uy:       { names: ["Ricardo"], colorIdx: 7 },
};

function m(
  id: string,
  stage: string,
  groupName: string | null,
  homeTeam: string, homeTeamName: string,
  awayTeam: string, awayTeamName: string,
  homeScore: number | null, awayScore: number | null,
  penaltyWinner: string | null,
  played: boolean,
  payouts?: TvPayout[],
): TvMatch {
  const ho = OWNERS[homeTeam];
  const ao = OWNERS[awayTeam];
  return {
    id, stage, groupName,
    homeTeam, homeTeamName,
    awayTeam, awayTeamName,
    homeScore, awayScore, penaltyWinner, played,
    payouts,
    homeOwnerNames: ho?.names ?? [],
    homeOwnerColorIdx: ho?.colorIdx ?? null,
    awayOwnerNames: ao?.names ?? [],
    awayOwnerColorIdx: ao?.colorIdx ?? null,
  };
}

// Standings order determines colorIdx
export const MOCK_PLAYERS: TvPlayer[] = [
  { id: "3", name: "Anthony", earnings: 8475, colorIdx: 0, teams: [{ code: "fr", name: "France" }, { code: "jp", name: "Japan" }, { code: "mx", name: "Mexico" }, { code: "ng", name: "Nigeria" }] },
  { id: "2", name: "Joe",     earnings: 6200, colorIdx: 1, teams: [{ code: "ar", name: "Argentina" }, { code: "gb-eng", name: "England" }, { code: "co", name: "Colombia" }, { code: "sn", name: "Senegal" }] },
  { id: "4", name: "Nico",    earnings: 5950, colorIdx: 2, teams: [{ code: "es", name: "Spain" }, { code: "nl", name: "Netherlands" }, { code: "eg", name: "Egypt" }, { code: "ca", name: "Canada" }] },
  { id: "1", name: "Angel",   earnings: 4800, colorIdx: 3, teams: [{ code: "br", name: "Brazil" }, { code: "pt", name: "Portugal" }, { code: "au", name: "Australia" }, { code: "ma", name: "Morocco" }] },
  { id: "6", name: "Ruben",   earnings: 3725, colorIdx: 4, teams: [{ code: "be", name: "Belgium" }, { code: "hr", name: "Croatia" }, { code: "ci", name: "Côte d'Ivoire" }, { code: "ec", name: "Ecuador" }] },
  { id: "5", name: "Spencer", earnings: 3100, colorIdx: 5, teams: [{ code: "de", name: "Germany" }, { code: "us", name: "USA" }, { code: "gh", name: "Ghana" }, { code: "kr", name: "South Korea" }] },
  { id: "8", name: "Chris",   earnings: 2450, colorIdx: 6, teams: [{ code: "pt", name: "Portugal" }, { code: "dk", name: "Denmark" }, { code: "pe", name: "Peru" }, { code: "qa", name: "Qatar" }] },
  { id: "7", name: "Ricardo", earnings: 1875, colorIdx: 7, teams: [{ code: "it", name: "Italy" }, { code: "uy", name: "Uruguay" }, { code: "cm", name: "Cameroon" }, { code: "rs", name: "Serbia" }] },
];

export const MOCK_TODAY_MATCHES: TvMatch[] = [
  m("t1", "group", "A", "fr", "France",  "de", "Germany",  2, 1, null, true, [{ playerId: "3", playerName: "Anthony", colorIdx: 0, cents: 325 }]),
  m("t2", "group", "B", "es", "Spain",   "gb-eng", "England", 3, 1, null, true, [{ playerId: "4", playerName: "Nico", colorIdx: 2, cents: 350 }]),
  m("t3", "group", "D", "br", "Brazil",  "co", "Colombia", 3, 0, null, true, [{ playerId: "1", playerName: "Angel", colorIdx: 3, cents: 375 }]),
];

const ALL_MATCHES: TvMatch[] = [
  // Group stage
  m("g1", "group", "A", "fr", "France",       "de", "Germany",     2, 1, null,  true),
  m("g2", "group", "A", "ar", "Argentina",    "br", "Brazil",      0, 0, null,  true),
  m("g3", "group", "B", "es", "Spain",        "gb-eng", "England", 3, 1, null,  true),
  m("g4", "group", "B", "nl", "Netherlands",  "be", "Belgium",     2, 0, null,  true),
  m("g5", "group", "C", "pt", "Portugal",     "it", "Italy",       1, 1, null,  true),
  m("g6", "group", "C", "de", "Germany",      "hr", "Croatia",     2, 2, null,  true),
  m("g7", "group", "D", "us", "USA",          "mx", "Mexico",      4, 2, null,  true),
  m("g8", "group", "D", "br", "Brazil",       "co", "Colombia",    3, 0, null,  true),
  // Round of 16
  m("r1", "r16", null, "fr", "France",        "nl", "Netherlands", 2, 1, null,  true),
  m("r2", "r16", null, "es", "Spain",         "ar", "Argentina",   1, 1, "es",  true),
  m("r3", "r16", null, "br", "Brazil",        "pt", "Portugal",    0, 1, null,  true),
  m("r4", "r16", null, "gb-eng", "England",   "de", "Germany",     null, null, null, false),
  // Quarter Finals
  m("q1", "qf", null, "fr", "France",         "es", "Spain",       null, null, null, false),
  m("q2", "qf", null, "pt", "Portugal",       "de", "Germany",     null, null, null, false),
  // Semi Finals
  m("s1", "sf", null, "fr", "France",         "pt", "Portugal",    null, null, null, false),
  // Final
  m("f1", "final", null, "fr", "France",      "es", "Spain",       null, null, null, false),
];

export const MOCK_MATCHES_BY_STAGE: Partial<Record<string, TvMatch[]>> = {
  group: ALL_MATCHES.filter((x) => x.stage === "group"),
  r16:   ALL_MATCHES.filter((x) => x.stage === "r16"),
  qf:    ALL_MATCHES.filter((x) => x.stage === "qf"),
  sf:    ALL_MATCHES.filter((x) => x.stage === "sf"),
  final: ALL_MATCHES.filter((x) => x.stage === "final"),
};
