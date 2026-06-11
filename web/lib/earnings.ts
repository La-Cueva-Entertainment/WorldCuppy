/**
 * Earnings engine — implements the friend-pool scoring rules.
 * All monetary amounts stored in cents internally ($1.00 = 100 cents).
 * Rules are configurable via ScoringConfig; defaults match the values below.
 *
 * Default rules:
 *   Group stage: Win +$3.00 | Draw +$1.00 | GD ×$0.25
 *   R32 / R16:   Win +$5.00 | GD ×$0.50
 *   QF:          Win +$10.00 | GD ×$1.00
 *   SF (WC):     Win +$15.00 | GD ×$2.00
 *   SF (Euros):  Win +$15.00 | GD ×$1.00
 *   3rd (WC):    Win +$10.00 | GD ×$3.00
 *   Final winner:    +$20.00 | goals ×$3.00
 *   Final runner-up: +$10.00 | goals ×$3.00
 *   Odds jump 2 spots: +$1.00 | 3+ spots: +$2.00
 */

export type TournamentType = "world_cup" | "euros";

export type Stage =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "3rd"
  | "final";

export type MatchResult = {
  stage: Stage;
  tournamentType: TournamentType;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  /** Team code that won on penalties (knockout rounds drawn after 90+ET) */
  penaltyWinner?: string | null;
};

export type OddsJumpInput = {
  teamCode: string;
  /** Pre-tournament odds rank (lower = bigger favourite) */
  draftOdds: number;
  /** Current odds rank */
  currentOdds: number;
};

/** Per-tournament scoring configuration (all monetary values in cents). */
export type ScoringConfig = {
  group: {
    win: number;
    draw: number;
    gdPerGoal: number;
  };
  r32r16: {
    win: number;
    gdPerGoal: number;
  };
  qf: {
    win: number;
    gdPerGoal: number;
  };
  sf: {
    win: number;
    gdPerGoalWc: number;
    gdPerGoalEuros: number;
  };
  third: {
    win: number;
    gdPerGoal: number;
  };
  final: {
    winnerBase: number;
    runnerUpBase: number;
    goalsMultiplier: number;
  };
  oddsJump: {
    jump2: number;
    jump3plus: number;
  };
  /** Reserved for future bonus payouts (e.g. hat-trick bonus, upset bonus). */
  bonuses: BonusPayout[];
  /** Buy-in per player in cents (used to calculate the total pot). */
  buyInCents: number;
  /** Prize distribution — each tier gets `pct`% of the total pot. Must sum to 100. */
  prizeTiers: PrizeTier[];
};

export type BonusPayout = {
  id: string;
  name: string;
  description?: string;
  amountCents: number;
};

export type PrizeTier = {
  place: number; // 1-indexed
  pct: number;   // percentage of pot (0–100)
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  group:   { win: 300,  draw: 100, gdPerGoal: 25 },
  r32r16:  { win: 500,  gdPerGoal: 50 },
  qf:      { win: 1000, gdPerGoal: 100 },
  sf:      { win: 1500, gdPerGoalWc: 200, gdPerGoalEuros: 100 },
  third:   { win: 1000, gdPerGoal: 300 },
  final:   { winnerBase: 2000, runnerUpBase: 1000, goalsMultiplier: 300 },
  oddsJump: { jump2: 100, jump3plus: 200 },
  bonuses: [],
  buyInCents: 4000,
  prizeTiers: [
    { place: 1, pct: 65 },
    { place: 2, pct: 35 },
  ],
};

/** Safely merge a partial DB config over the defaults. */
export function resolveConfig(raw: unknown): ScoringConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_SCORING_CONFIG;
  const r = raw as Partial<ScoringConfig>;
  return {
    group:    { ...DEFAULT_SCORING_CONFIG.group,    ...(r.group    ?? {}) },
    r32r16:   { ...DEFAULT_SCORING_CONFIG.r32r16,   ...(r.r32r16   ?? {}) },
    qf:       { ...DEFAULT_SCORING_CONFIG.qf,       ...(r.qf       ?? {}) },
    sf:       { ...DEFAULT_SCORING_CONFIG.sf,       ...(r.sf       ?? {}) },
    third:    { ...DEFAULT_SCORING_CONFIG.third,    ...(r.third    ?? {}) },
    final:    { ...DEFAULT_SCORING_CONFIG.final,    ...(r.final    ?? {}) },
    oddsJump:   { ...DEFAULT_SCORING_CONFIG.oddsJump, ...(r.oddsJump ?? {}) },
    bonuses:    Array.isArray(r.bonuses) ? r.bonuses : [],
    buyInCents: typeof r.buyInCents === "number" ? r.buyInCents : DEFAULT_SCORING_CONFIG.buyInCents,
    prizeTiers: Array.isArray(r.prizeTiers) ? r.prizeTiers : DEFAULT_SCORING_CONFIG.prizeTiers,
  };
}

/**
 * Returns earnings in cents for one player owning one team in one match.
 * Pass `ownsHome` / `ownsAway` separately and call twice if player owns both.
 */
export function matchEarningsCents(
  result: MatchResult,
  ownsHome: boolean,
  ownsAway: boolean,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (!ownsHome && !ownsAway) return 0;

  const { stage, tournamentType, homeScore, awayScore, penaltyWinner } = result;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const draw = homeScore === awayScore;
  const gd = Math.abs(homeScore - awayScore);

  let total = 0;

  function earnFor(ownsThisTeam: boolean, thisTeamWon: boolean, thisTeamGoals: number, thisTeamCode: string) {
    if (!ownsThisTeam) return;
    const penWon = penaltyWinner ? penaltyWinner === thisTeamCode : false;

    switch (stage) {
      case "group": {
        if (thisTeamWon) total += config.group.win + gd * config.group.gdPerGoal;
        else if (draw) total += config.group.draw;
        break;
      }
      case "r32":
      case "r16": {
        if (thisTeamWon || penWon) total += config.r32r16.win + gd * config.r32r16.gdPerGoal;
        break;
      }
      case "qf": {
        if (thisTeamWon || penWon) total += config.qf.win + gd * config.qf.gdPerGoal;
        break;
      }
      case "sf": {
        const gdBonus = tournamentType === "world_cup" ? config.sf.gdPerGoalWc : config.sf.gdPerGoalEuros;
        if (thisTeamWon || penWon) total += config.sf.win + gd * gdBonus;
        break;
      }
      case "3rd": {
        if (tournamentType !== "world_cup") break;
        if (thisTeamWon || penWon) total += config.third.win + gd * config.third.gdPerGoal;
        break;
      }
      case "final": {
        if (thisTeamWon || penWon) {
          total += config.final.winnerBase + thisTeamGoals * config.final.goalsMultiplier;
        } else {
          total += config.final.runnerUpBase + thisTeamGoals * config.final.goalsMultiplier;
        }
        break;
      }
    }
  }

  earnFor(ownsHome, homeWon, homeScore, result.homeTeam);
  earnFor(ownsAway, awayWon, awayScore, result.awayTeam);

  return total;
}

/**
 * Odds-jump bonus:
 *   2 positions better than draft rank → +jump2
 *   3+ positions better → +jump3plus
 */
export function oddsJumpBonusCents(
  teams: OddsJumpInput[],
  ownerTeamCodes: string[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  if (!teams.length || !ownerTeamCodes.length) return 0;

  const sorted = teams.slice().sort((a, b) => a.draftOdds - b.draftOdds);
  const draftRank = new Map(sorted.map((t, i) => [t.teamCode, i]));

  const sortedCurrent = teams.slice().sort((a, b) => a.currentOdds - b.currentOdds);
  const currentRank = new Map(sortedCurrent.map((t, i) => [t.teamCode, i]));

  let bonus = 0;
  for (const code of ownerTeamCodes) {
    const from = draftRank.get(code) ?? 0;
    const to = currentRank.get(code) ?? 0;
    const jump = from - to;
    if (jump >= 3) bonus += config.oddsJump.jump3plus;
    else if (jump >= 2) bonus += config.oddsJump.jump2;
  }
  return bonus;
}

/** Sum earnings in cents across multiple matches for one player's teams. */
export function totalEarningsCents(
  matches: MatchResult[],
  ownerTeamCodes: Set<string>,
  oddsData?: OddsJumpInput[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  let total = 0;
  for (const m of matches) {
    const oh = ownerTeamCodes.has(m.homeTeam);
    const oa = ownerTeamCodes.has(m.awayTeam);
    total += matchEarningsCents(m, oh, oa, config);
  }
  if (oddsData && oddsData.length > 0) {
    total += oddsJumpBonusCents(oddsData, [...ownerTeamCodes], config);
  }
  return total;
}

/**
 * Returns the prize each player would receive if the tournament ended now.
 * `rankedIds` must be sorted by earnings descending (1st place first).
 */
export function calcPrizeCents(
  rankedIds: string[],
  playerCount: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): Map<string, number> {
  const pot = config.buyInCents * playerCount;
  const prizes = new Map<string, number>();
  for (const tier of config.prizeTiers) {
    const uid = rankedIds[tier.place - 1];
    if (uid) prizes.set(uid, Math.round((pot * tier.pct) / 100));
  }
  return prizes;
}

export function formatDollars(cents: number): string {
  const n = Math.max(0, Math.round(cents));
  return `$${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}
