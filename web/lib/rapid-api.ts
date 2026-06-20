/**
 * rapid-api.ts — Venue data from the FIFA World Cup feed via RapidAPI.
 *
 * Endpoint: football-news-aggregator-live.p.rapidapi.com/worldcup/fixtures
 * Returns all 104 WC 2026 fixtures including venue and city from the FIFA
 * calendar API. One request fetches everything.
 *
 * Configure: RAPIDAPI_KEY=<your key from rapidapi.com>
 */

const RAPID_BASE = "https://football-news-aggregator-live.p.rapidapi.com";
const RAPID_HOST = "football-news-aggregator-live.p.rapidapi.com";
const RAPID_KEY = process.env.RAPIDAPI_KEY ?? "";

// Conservative: at least 10s between calls to avoid hammering the free tier.
let lastCallAt = 0;
const MIN_CALL_GAP_MS = 10_000;

// ─── Raw API types ──────────────────────────────────────────────────────────
interface RapidTeam {
  name: string;
  code: string;
  slug: string;
}

interface RapidFixture {
  matchId: string;
  homeTeam: RapidTeam;
  awayTeam: RapidTeam;
  venue: string | null;
  city: string | null;
  group: string | null;
  phase: string;
}

interface RapidFixturesResponse {
  success: boolean;
  count: number;
  data: RapidFixture[];
}

// ─── Public result types ────────────────────────────────────────────────────
export type RapidVenueSyncResult =
  | { ok: false; reason: "no_token" }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "api_error"; status: number; body?: string }
  | {
      ok: true;
      /** homeTla:awayTla → "venue name, city" */
      venues: Map<string, string>;
      fixtureCount: number;
      venueCount: number;
    };

/**
 * Fetches all WC 2026 fixtures from the FIFA feed via RapidAPI and returns
 * a venue lookup map keyed by "homeTla:awayTla" (lowercase). Both directions
 * are stored so home/away ordering differences are handled.
 */
export async function fetchVenuesFromRapidApi(): Promise<RapidVenueSyncResult> {
  if (!RAPID_KEY) return { ok: false, reason: "no_token" };

  const now = Date.now();
  if (now - lastCallAt < MIN_CALL_GAP_MS) return { ok: false, reason: "rate_limited" };
  lastCallAt = now;

  let resp: Response;
  try {
    resp = await fetch(`${RAPID_BASE}/worldcup/fixtures`, {
      headers: {
        "x-rapidapi-host": RAPID_HOST,
        "x-rapidapi-key": RAPID_KEY,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "api_error", status: 0, body: "Network error" };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, reason: "api_error", status: resp.status, body };
  }

  const data = (await resp.json()) as RapidFixturesResponse;
  const fixtures = data.data ?? [];

  const venues = new Map<string, string>();

  for (const fix of fixtures) {
    const venueName = fix.venue;
    if (!venueName) continue;

    const homeTla = fix.homeTeam?.code?.toLowerCase();
    const awayTla = fix.awayTeam?.code?.toLowerCase();
    if (!homeTla || !awayTla) continue;

    const label = fix.city ? `${venueName}, ${fix.city}` : venueName;
    venues.set(`${homeTla}:${awayTla}`, label);
    venues.set(`${awayTla}:${homeTla}`, label);
  }

  return {
    ok: true,
    venues,
    fixtureCount: fixtures.length,
    venueCount: venues.size / 2,
  };
}
