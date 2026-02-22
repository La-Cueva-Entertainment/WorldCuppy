import bovadaOdds from "@/data/bovada-odds.json";

// `bovada-odds.json` is expected to be a simple mapping:
// { "Spain": 450, "England": 550, ... }
// where the numbers are American odds (e.g. +450 as 450, -120 as -120).
const RAW_ODDS_BY_NAME = bovadaOdds as Record<string, number>;

function stripDiacritics(input: string) {
  // NFKD splits accents into combining marks; remove those marks.
  return input.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

export function normalizeTeamName(name: string) {
  const cleaned = stripDiacritics(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Common aliases between FIFA naming and sportsbook naming.
  if (cleaned === "usa" || cleaned === "us" || cleaned === "u s" || cleaned === "u s a") {
    return "united states";
  }
  if (cleaned === "korea republic" || cleaned === "republic of korea") return "south korea";
  if (cleaned === "ir iran") return "iran";

  return cleaned;
}

const ODDS_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(RAW_ODDS_BY_NAME)
    .map(([name, odds]) => [normalizeTeamName(name), odds] as const)
    .filter(([, odds]) => typeof odds === "number" && Number.isFinite(odds) && odds !== 0),
);

export function americanOddsToImpliedProbability(odds: number) {
  if (!Number.isFinite(odds) || odds === 0) return null;

  // Odds are typically in the hundreds or thousands.
  // +450 => 100/(450+100)
  // -120 => 120/(120+100)
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

type ProbRange = { min: number; max: number };

function computeProbRange(): ProbRange | null {
  const probs = Object.values(ODDS_BY_NAME)
    .map(americanOddsToImpliedProbability)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));

  if (probs.length < 2) return null;

  let min = probs[0]!;
  let max = probs[0]!;
  for (const p of probs) {
    if (p < min) min = p;
    if (p > max) max = p;
  }

  // Guard against a degenerate set.
  if (min === max) return null;

  return { min, max };
}

const PROB_RANGE = computeProbRange();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function priceFromAmericanOdds(odds: number, opts?: { minPrice?: number; maxPrice?: number }) {
  const minPrice = opts?.minPrice ?? 8;
  const maxPrice = opts?.maxPrice ?? 22;

  const p = americanOddsToImpliedProbability(odds);
  if (p == null) return null;

  // If we have no range (or the odds file is empty), use conservative defaults.
  const minProb = PROB_RANGE?.min ?? 0.001;
  const maxProb = PROB_RANGE?.max ?? 0.25;

  const t = (clamp(p, minProb, maxProb) - minProb) / (maxProb - minProb);
  return Math.round(minPrice + t * (maxPrice - minPrice));
}

export function getAmericanOddsForTeamName(teamName: string) {
  const key = normalizeTeamName(teamName);
  const odds = ODDS_BY_NAME[key];
  return typeof odds === "number" && Number.isFinite(odds) ? odds : null;
}

export function getCurrentPriceFromOdds(teamName: string) {
  const odds = getAmericanOddsForTeamName(teamName);
  if (odds == null) return null;
  return priceFromAmericanOdds(odds);
}
