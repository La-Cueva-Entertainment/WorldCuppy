/**
 * Earnings engine — implements the friend-pool scoring rules:
 *
 * Group stage (per match):
 *   Win +$3.00 | Tie +$1.00 | GD ×$0.25
 *   Odds-jump bonuses: 2 spots jumped +$1, 3+ spots jumped +$2
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
  /** Pre-tournament odds (American format, e.g. 350 or -225) */
  draftOdds: number;
  /** Odds at start of the round (for jump calculation) */
  currentOdds: number;
};

/**
 * Returns earnings in cents for one player owning one team in one match.
 * Pass `ownsHome` / `ownsAway` separately and call twice if player owns both.
 */
export function matchEarningsCents(
  result: MatchResult,
  ownsHome: boolean,
  ownsAway: boolean,
): number {
  if (!ownsHome && !ownsAway) return 0;

  const { stage, tournamentType, homeScore, awayScore, penaltyWinner } = result;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const draw = homeScore === awayScore;
  const gd = Math.abs(homeScore - awayScore);

  let total = 0;

  function earnFor(ownsThisTeam: boolean, thisTeamWon: boolean, thisTeamGoals: number) {
    if (!ownsThisTeam) return;

    switch (stage) {
      case "group": {
        if (thisTeamWon) total += 300 + gd * 25;
        else if (draw) total += 100;
        break;
      }
      case "r32":
      case "r16": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += 500 + gd * 50;
        break;
      }
      case "qf": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += 1000 + gd * 100;
        break;
      }
      case "sf": {
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        const gdBonus = tournamentType === "world_cup" ? 200 : 100;
        if (winner) total += 1500 + gd * gdBonus;
        break;
      }
      case "3rd": {
        if (tournamentType !== "world_cup") break;
        const winner = penaltyWinner
          ? penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam)
          : thisTeamWon;
        if (winner) total += 1000 + gd * 300;
        break;
      }
      case "final": {
        if (thisTeamWon || (penaltyWinner && penaltyWinner === (ownsHome ? result.homeTeam : result.awayTeam))) {
          // Winner
          total += 2000 + thisTeamGoals * 300;
        } else {
          // Runner-up
          total += 1000 + thisTeamGoals * 300;
        }
        break;
      }
    }
  }

  earnFor(ownsHome, homeWon, homeScore);
  earnFor(ownsAway, awayWon, awayScore);

  return total;
}

/**
 * Odds-jump bonus (group stage):
 *   2 positions better → +$1.00
 *   3+ positions better → +$2.00
 *
 * "Jump" = player's draft position minus current odds position.
 * Rankings are determined by sorting ascending by odds value (lower = favourite).
 */
export function oddsJumpBonusCents(
  teams: OddsJumpInput[],
  ownerTeamCodes: string[],
): number {
  if (!teams.length || !ownerTeamCodes.length) return 0;

  // Sort by draft odds ascending (lower number = bigger favourite = rank 1)
  const sorted = teams.slice().sort((a, b) => a.draftOdds - b.draftOdds);
  const draftRank = new Map(sorted.map((t, i) => [t.teamCode, i]));

  const sortedCurrent = teams.slice().sort((a, b) => a.currentOdds - b.currentOdds);
  const currentRank = new Map(sortedCurrent.map((t, i) => [t.teamCode, i]));

  let bonus = 0;
  for (const code of ownerTeamCodes) {
    const from = draftRank.get(code) ?? 0;
    const to = currentRank.get(code) ?? 0;
    const jump = from - to; // positive = moved up (improved)
    if (jump >= 3) bonus += 200;
    else if (jump >= 2) bonus += 100;
  }
  return bonus;
}

/** Sum earnings in cents across multiple matches for one player's teams. */
export function totalEarningsCents(
  matches: MatchResult[],
  ownerTeamCodes: Set<string>,
): number {
  let total = 0;
  for (const m of matches) {
    const oh = ownerTeamCodes.has(m.homeTeam);
    const oa = ownerTeamCodes.has(m.awayTeam);
    total += matchEarningsCents(m, oh, oa);
  }
  return total;
}

export function formatDollars(cents: number): string {
  const n = Math.max(0, Math.round(cents));
  return `$${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
}

