const API_BASE = "https://api.football-data.org/v4";
const TOKEN = process.env.FOOTBALL_DATA_API_TOKEN ?? "";
const WC_COMPETITION = "2000";

// Server-side rate limiter: max 8 calls per minute = 1 call per 7.5s minimum
const CALL_INTERVAL_MS = 7500;
let lastCallAt = 0;
let nextAllowedAt = 0;

export function getNextAllowedAt() {
  return nextAllowedAt;
}

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "group",
  ROUND_OF_32: "r32",
  ROUND_OF_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  THIRD_PLACE: "3rd",
  FINAL: "final",
};

export interface ApiMatch {
  externalId: string;
  stage: string;
  groupName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinner: string | null;
  played: boolean;
  live: boolean;
  matchDate: Date | null;
  venue: string | null;
}

export type RateLimitResult =
  | { ok: false; reason: "rate_limited"; nextAllowedAt: number }
  | { ok: false; reason: "no_token" }
  | { ok: false; reason: "api_error"; status: number }
  | { ok: true; matches: ApiMatch[]; requestsRemaining: number };

export async function fetchWorldCupMatches(season = 2026): Promise<RateLimitResult> {
  if (!TOKEN) return { ok: false, reason: "no_token" };

  const now = Date.now();
  if (now < nextAllowedAt) {
    return { ok: false, reason: "rate_limited", nextAllowedAt };
  }

  lastCallAt = now;
  nextAllowedAt = now + CALL_INTERVAL_MS;

  const resp = await fetch(
    `${API_BASE}/competitions/${WC_COMPETITION}/matches?season=${season}`,
    {
      headers: { "X-Auth-Token": TOKEN },
      cache: "no-store",
    }
  );

  // Check remaining quota — back off if ≤ 2 left in this minute
  const remaining = Number(resp.headers.get("X-Requests-Available-Minute") ?? "10");
  if (remaining <= 2) {
    const resetSecs = Number(resp.headers.get("X-RequestCounter-Reset") ?? "60");
    nextAllowedAt = Date.now() + resetSecs * 1000;
  }

  if (!resp.ok) return { ok: false, reason: "api_error", status: resp.status };

  const data = (await resp.json()) as { matches: ApiRawMatch[] };

  const matches: ApiMatch[] = data.matches.map((m) => {
    const stage = STAGE_MAP[m.stage] ?? m.stage.toLowerCase();
    const groupName = m.group ? m.group.replace(/^GROUP_/, "") : null;

    const homeTla = m.homeTeam?.tla?.toLowerCase() ?? null;
    const awayTla = m.awayTeam?.tla?.toLowerCase() ?? null;

    const ft = m.score?.fullTime;
    const homeScore = ft?.home ?? null;
    const awayScore = ft?.away ?? null;

    const played = m.status === "FINISHED";
    const live = m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "HALFTIME";
    let penaltyWinner: string | null = null;
    if (played && m.score?.duration === "PENALTY_SHOOTOUT") {
      penaltyWinner = m.score.winner === "HOME_TEAM" ? homeTla : m.score.winner === "AWAY_TEAM" ? awayTla : null;
    }

    return {
      externalId: String(m.id),
      stage,
      groupName,
      homeTeam: homeTla,
      awayTeam: awayTla,
      homeScore,
      awayScore,
      penaltyWinner,
      played,
      live,
      matchDate: m.utcDate ? new Date(m.utcDate) : null,
      venue: m.venue ?? null,
    };
  });

  return { ok: true, matches, requestsRemaining: remaining };
}

export type FdVenueSyncResult =
  | { ok: false; reason: "no_token" }
  | { ok: false; reason: "rate_limited"; nextAllowedAt: number }
  | { ok: false; reason: "api_error"; status: number }
  | { ok: true; venues: Map<string, string>; matchCount: number; venueCount: number };

/**
 * Builds a homeTla:awayTla → venue map from the football-data.org match list.
 * Shares the same rate-limiter as fetchWorldCupMatches (7.5 s minimum gap).
 * Uses 1 API request out of the 10/minute free quota.
 */
export async function fetchVenuesFromFootballData(season = 2026): Promise<FdVenueSyncResult> {
  const result = await fetchWorldCupMatches(season);
  if (!result.ok) return result;

  const venues = new Map<string, string>();
  for (const m of result.matches) {
    if (!m.homeTeam || !m.awayTeam || !m.venue) continue;
    const key = `${m.homeTeam}:${m.awayTeam}`;
    venues.set(key, m.venue);
    venues.set(`${m.awayTeam}:${m.homeTeam}`, m.venue);
  }

  return {
    ok: true,
    venues,
    matchCount: result.matches.length,
    venueCount: venues.size / 2,
  };
}

// Raw types from football-data.org v4
interface ApiRawMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | HALFTIME | FINISHED | ...
  stage: string;
  group: string | null;
  venue: string | null;
  homeTeam: { tla: string | null } | null;
  awayTeam: { tla: string | null } | null;
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
  } | null;
}
