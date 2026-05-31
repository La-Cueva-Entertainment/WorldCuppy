import type { TvPlayer, TvMatch, TvPayout } from "@/components/TournamentView";
import type { ProfileContentProps } from "@/components/ProfileContent";
import { TEAMS } from "@/lib/teams";

const OWNERS: Record<string, { names: string[]; colorIdx: number }> = {
  fr: { names: ["Anthony"], colorIdx: 0 },
  ar: { names: ["Joe"],     colorIdx: 1 },
  es: { names: ["Nico"],    colorIdx: 2 },
  br: { names: ["Angel"],   colorIdx: 3 },
  be: { names: ["Ruben"],   colorIdx: 4 },
  de: { names: ["Spencer"], colorIdx: 5 },
  it: { names: ["Ricardo"], colorIdx: 7 },
  pt: { names: ["Angel"], colorIdx: 3 },
  ch: { names: ["Chris"], colorIdx: 6 },
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
  { id: "8", name: "Chris",   earnings: 2450, colorIdx: 6, teams: [{ code: "ch", name: "Switzerland" }, { code: "dk", name: "Denmark" }, { code: "pe", name: "Peru" }, { code: "qa", name: "Qatar" }] },
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

// ─── Profile preview mock data ────────────────────────────────────────────────

export const MOCK_PROFILE_PROPS: ProfileContentProps = {
  upcomingTournament: {
    id: "mock-upcoming-1",
    name: "FIFA World Cup",
    year: 2026,
    status: "draft",
    draftDate: null,
    teamsPerPlayer: 4,
  },
  activeTournamentName: "Copa América 2024",
  totalEarnedCents: 875,
  teams: [
    {
      teamCode: "fr",
      earnedCents: 875,
      matchBreakdown: [
        {
          stage: "group",
          oppCode: "de",
          myScore: 2, oppScore: 1,
          earnedCents: 325,
          isWin: true, isDraw: false,
          matchDate: new Date("2026-06-15T19:00:00Z"),
          venue: "MetLife Stadium, East Rutherford",
        },
        {
          stage: "r16",
          oppCode: "nl",
          myScore: 2, oppScore: 1,
          earnedCents: 550,
          isWin: true, isDraw: false,
          matchDate: new Date("2026-07-01T23:00:00Z"),
          venue: "SoFi Stadium, Los Angeles",
        },
      ],
    },
    {
      teamCode: "mx",
      earnedCents: 0,
      matchBreakdown: [
        {
          stage: "group",
          oppCode: "us",
          myScore: 2, oppScore: 4,
          earnedCents: 0,
          isWin: false, isDraw: false,
          matchDate: new Date("2026-06-14T22:00:00Z"),
          venue: "AT&T Stadium, Dallas",
        },
      ],
    },
    { teamCode: "jp", earnedCents: 0, matchBreakdown: [] },
    { teamCode: "ng", earnedCents: 0, matchBreakdown: [] },
  ],
  history: [
    { id: "mock-hist-1", name: "FIFA World Cup", year: 2022, teamCodes: ["ar", "fr", "hr", "ma"] },
  ],
};

// ─── Draft preview mock data ──────────────────────────────────────────────────

const DRAFT_ORDER = [
  { name: "Anthony", colorIndex: 0 },
  { name: "Joe",     colorIndex: 1 },
  { name: "Nico",    colorIndex: 2 },
  { name: "Angel",   colorIndex: 3 },
  { name: "Ruben",   colorIndex: 4 },
  { name: "Spencer", colorIndex: 5 },
  { name: "Chris",   colorIndex: 6 },
  { name: "Ricardo", colorIndex: 7 },
];

// Round 1 (picks 0–7, forward): Anthony→esp, Joe→arg, Nico→fra, Angel→eng, Ruben→bra, Spencer→por, Chris→ned, Ricardo→mar
// Round 2 (picks 8–11 so far, backward): Ricardo→bel, Chris→ger, Spencer→cro, Ruben→sen
// Current: Angel's turn (pick 12, round 2 pick 5 of 8, backward order index 3 = Angel)
const TAKEN_MAP: Record<string, { name: string; colorIndex: number }> = {
  esp: DRAFT_ORDER[0], arg: DRAFT_ORDER[1], fra: DRAFT_ORDER[2], eng: DRAFT_ORDER[3],
  bra: DRAFT_ORDER[4], por: DRAFT_ORDER[5], ned: DRAFT_ORDER[6], mar: DRAFT_ORDER[7],
  bel: DRAFT_ORDER[7], ger: DRAFT_ORDER[6], cro: DRAFT_ORDER[5], sen: DRAFT_ORDER[4],
};

export const MOCK_DRAFT_TAKEN_CODES = Object.keys(TAKEN_MAP);

export const MOCK_DRAFT_TAKEN_BY: Record<string, { label: string; colorIndex: number }> = Object.fromEntries(
  Object.entries(TAKEN_MAP).map(([code, p]) => [code, { label: p.name, colorIndex: p.colorIndex }])
);

export const MOCK_DRAFT_MY_TEAMS = ["esp"];

export const MOCK_DRAFT_ORDER = DRAFT_ORDER.map((p, idx) => ({
  ...p,
  picks: Object.values(TAKEN_MAP).filter((v) => v.name === p.name).length,
  isCurrent: idx === 3, // Angel's turn
}));

export const MOCK_DRAFT_CURRENT_PICKER = "Angel";
export const MOCK_DRAFT_ROUND = 2;
export const MOCK_DRAFT_PICK_IN_ROUND = 5;
export const MOCK_DRAFT_PLAYER_COUNT = 8;

// Pick history — newest first
export const MOCK_DRAFT_PICK_HISTORY = [
  { pickNumber: 11, playerName: "Ruben",   colorIndex: 4, teamCode: "sen", teamName: "Senegal",     pickedAt: "Jun 5, 2:11 PM" },
  { pickNumber: 10, playerName: "Spencer", colorIndex: 5, teamCode: "cro", teamName: "Croatia",     pickedAt: "Jun 5, 2:10 PM" },
  { pickNumber: 9,  playerName: "Chris",   colorIndex: 6, teamCode: "ger", teamName: "Germany",     pickedAt: "Jun 5, 2:09 PM" },
  { pickNumber: 8,  playerName: "Ricardo", colorIndex: 7, teamCode: "bel", teamName: "Belgium",     pickedAt: "Jun 5, 2:08 PM" },
  { pickNumber: 7,  playerName: "Ricardo", colorIndex: 7, teamCode: "mar", teamName: "Morocco",     pickedAt: "Jun 5, 2:07 PM" },
  { pickNumber: 6,  playerName: "Chris",   colorIndex: 6, teamCode: "ned", teamName: "Netherlands", pickedAt: "Jun 5, 2:06 PM" },
  { pickNumber: 5,  playerName: "Spencer", colorIndex: 5, teamCode: "por", teamName: "Portugal",    pickedAt: "Jun 5, 2:05 PM" },
  { pickNumber: 4,  playerName: "Ruben",   colorIndex: 4, teamCode: "bra", teamName: "Brazil",      pickedAt: "Jun 5, 2:04 PM" },
  { pickNumber: 3,  playerName: "Angel",   colorIndex: 3, teamCode: "eng", teamName: "England",     pickedAt: "Jun 5, 2:03 PM" },
  { pickNumber: 2,  playerName: "Nico",    colorIndex: 2, teamCode: "fra", teamName: "France",      pickedAt: "Jun 5, 2:02 PM" },
  { pickNumber: 1,  playerName: "Joe",     colorIndex: 1, teamCode: "arg", teamName: "Argentina",   pickedAt: "Jun 5, 2:01 PM" },
  { pickNumber: 0,  playerName: "Anthony", colorIndex: 0, teamCode: "esp", teamName: "Spain",       pickedAt: "Jun 5, 2:00 PM" },
];

