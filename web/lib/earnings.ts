import { TEAMS } from "@/lib/teams";

// Build a tier lookup once at module load (tier 1 = best ranked, tier 4 = worst).
const _sortedByRank = TEAMS.slice().sort((a, b) => a.rank - b.rank);
const _tierChunk = Math.ceil(_sortedByRank.length / 4);
const TEAM_TIER = new Map<string, number>(
  _sortedByRank.map((t, i) => [t.code, Math.floor(i / _tierChunk) + 1])
);

/**
 * Earnings engine — implements the friend-pool scoring rules:
 *
 * Group stage (per match):
 *   Win +$3.00 | Tie +$1.00 | GD ×$0.25
 *   Tier upset bonus (group stage only): winner 1 tier worse +$1, 2 tiers +$2, 3+ tiers +$3
 *
 * Round of 32 (WC only): Win +$5 | GD ×$0.50
 * Round of 16: Win +$5 | GD ×$0.50  (Euros: same)
 * Quarter Final: Win +$10 | GD ×$1.00
 * Semi Final: Win +$15 | GD ×$2.00 (WC) / ×$1.00 (Euros)
 * 3rd Place (WC): Win +$10 | GD ×$3.00
 * 2nd Place (Runner-up): +$10 | Goals ×$3.00
 * Winner: +$20 | Goals ×$3.00
 *
 * All amounts in cents internally ($1.00 = 100 cents).
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

/** All configurable payout amounts, stored in cents. */
export type PayoutRules = {
  groupWinBase: number;         // win payout base
  groupWinGdPer: number;        // per goal difference on a win
  groupDraw: number;            // draw payout
  r32WinBase: number;
  r32WinGdPer: number;
  r16WinBase: number;
  r16WinGdPer: number;
  qfWinBase: number;
  qfWinGdPer: number;
  sfWinBase: number;
  sfWinGdPerWC: number;         // world_cup GD bonus per goal
  sfWinGdPerEuros: number;      // euros GD bonus per goal
  thirdWinBase: number;
  thirdWinGdPer: number;
  finalWinnerBase: number;
  finalWinnerGoalPer: number;
  finalRunnerUpBase: number;
  finalRunnerUpGoalPer: number;
  upsetBonus1Tier: number;  // group stage: winning team is 1 tier below the loser
  upsetBonus2Tier: number;  // group stage: winning team is 2 tiers below the loser
  upsetBonus3Tier: number;  // group stage: winning team is 3+ tiers below the loser
};

export const DEFAULT_PAYOUT_RULES: PayoutRules = {
  groupWinBase: 300,
  groupWinGdPer: 25,
  groupDraw: 100,
  r32WinBase: 500,
  r32WinGdPer: 50,
  r16WinBase: 500,
  r16WinGdPer: 50,
  qfWinBase: 1000,
  qfWinGdPer: 100,
  sfWinBase: 1500,
  sfWinGdPerWC: 200,
  sfWinGdPerEuros: 100,
  thirdWinBase: 1000,
  thirdWinGdPer: 300,
  finalWinnerBase: 2000,
  finalWinnerGoalPer: 300,
  finalRunnerUpBase: 1000,
  finalRunnerUpGoalPer: 300,
  upsetBonus1Tier: 100,
  upsetBonus2Tier: 200,
  upsetBonus3Tier: 300,
};

/** Merge a partial (e.g. from DB JSON) with defaults — safe for unknown keys. */
export function resolvePayoutRules(partial?: Partial<PayoutRules> | null): PayoutRules {
  if (!partial) return DEFAULT_PAYOUT_RULES;
  return { ...DEFAULT_PAYOUT_RULES, ...partial };
}

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

/**
 * Returns earnings in cents for one player owning one team in one match.
 * Pass `ownsHome` / `ownsAway` separately and call twice if player owns both.
 */
export function matchEarningsCents(
  result: MatchResult,
  ownsHome: boolean,
  ownsAway: boolean,
  rules: PayoutRules = DEFAULT_PAYOUT_RULES,
): number {
  if (!ownsHome && !ownsAway) return 0;

  const { stage, tournamentType, homeScore, awayScore, penaltyWinner } = result;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const draw = homeScore === awayScore;
  const gd = Math.abs(homeScore - awayScore);

  let total = 0;

  function earnFor(ownsThisTeam: boolean, thisTeamWon: boolean, thisTeamGoals: number, thisTeamCode: string, opponentCode: string) {
    if (!ownsThisTeam) return;

    switch (stage) {
      case "group": {
        if (thisTeamWon) {
          total += rules.groupWinBase + gd * rules.groupWinGdPer;
          // Tier upset bonus: positive gap means winner is in a worse (higher-numbered) tier
          const winnerTier = TEAM_TIER.get(thisTeamCode) ?? 4;
          const loserTier = TEAM_TIER.get(opponentCode) ?? 1;
          const tierGap = winnerTier - loserTier;
          if (tierGap >= 3) total += rules.upsetBonus3Tier;
          else if (tierGap === 2) total += rules.upsetBonus2Tier;
          else if (tierGap === 1) total += rules.upsetBonus1Tier;
        } else if (draw) total += rules.groupDraw;
        break;
      }
      case "r32": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += rules.r32WinBase + gd * rules.r32WinGdPer;
        break;
      }
      case "r16": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += rules.r16WinBase + gd * rules.r16WinGdPer;
        break;
      }
      case "qf": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += rules.qfWinBase + gd * rules.qfWinGdPer;
        break;
      }
      case "sf": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        const gdBonus = tournamentType === "world_cup" ? rules.sfWinGdPerWC : rules.sfWinGdPerEuros;
        if (winner) total += rules.sfWinBase + gd * gdBonus;
        break;
      }
      case "3rd": {
        if (tournamentType !== "world_cup") break;
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += rules.thirdWinBase + gd * rules.thirdWinGdPer;
        break;
      }
      case "final": {
        if (thisTeamWon || (penaltyWinner && penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam))) {
          total += rules.finalWinnerBase + thisTeamGoals * rules.finalWinnerGoalPer;
        } else {
          total += rules.finalRunnerUpBase + thisTeamGoals * rules.finalRunnerUpGoalPer;
        }
        break;
      }
    }
  }

  earnFor(ownsHome, homeWon, homeScore, result.homeTeam, result.awayTeam);
  earnFor(ownsAway, awayWon, awayScore, result.awayTeam, result.homeTeam);

  return total;
}

/** Sum earnings in cents across multiple matches for one player's teams. */
export function totalEarningsCents(
  matches: MatchResult[],
  ownerTeamCodes: Set<string>,
  rules: PayoutRules = DEFAULT_PAYOUT_RULES,
): number {
  let total = 0;
  for (const m of matches) {
    const oh = ownerTeamCodes.has(m.homeTeam);
    const oa = ownerTeamCodes.has(m.awayTeam);
    total += matchEarningsCents(m, oh, oa, rules);
  }
  return total;
}

export function formatDollars(cents: number): string {
  const n = Math.max(0, Math.round(cents));
  return `$${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}

