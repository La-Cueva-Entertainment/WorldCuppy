/**
 * api-football.ts — Integration with api-football.com (API-Sports).
 *
 * Free tier: 100 requests/day. This module is used ONLY for venue enrichment,
 * NOT for live score syncing. A single call fetches all fixtures at once.
 *
 * Configure: API_FOOTBALL_TOKEN=<your key from dashboard.api-football.com>
 */

const AF_BASE = "https://v3.football.api-sports.io";
const AF_TOKEN = process.env.API_FOOTBALL_TOKEN ?? "";

// World Cup league ID in API-Football
const AF_WC_LEAGUE = "1";

// Conservative: at least 60s between calls server-side to prevent accidental double-fires.
let lastCallAt = 0;
const MIN_CALL_GAP_MS = 60_000;

// ─── Name → TLA mapping ────────────────────────────────────────────────────
// API-Football uses English team names which can differ from our TLA codes.
const AF_NAME_TO_TLA: Record<string, string> = {
  "Spain": "esp",
  "Argentina": "arg",
  "France": "fra",
  "England": "eng",
  "Brazil": "bra",
  "Portugal": "por",
  "Netherlands": "ned",
  "Morocco": "mar",
  "Belgium": "bel",
  "Germany": "ger",
  "Croatia": "cro",
  "Senegal": "sen",
  "Colombia": "col",
  "United States": "usa",
  "USA": "usa",
  "Mexico": "mex",
  "Uruguay": "uru",
  "Switzerland": "sui",
  "Japan": "jpn",
  "Iran": "irn",
  "IR Iran": "irn",
  "Sweden": "swe",
  "South Korea": "kor",
  "Korea Republic": "kor",
  "Ecuador": "ecu",
  "Austria": "aut",
  "Turkey": "tur",
  "Australia": "aus",
  "Algeria": "alg",
  "Canada": "can",
  "Egypt": "egy",
  "Norway": "nor",
  "Panama": "pan",
  "Czech Republic": "cze",
  "Czechia": "cze",
  "Ivory Coast": "civ",
  "Cote d'Ivoire": "civ",
  "Côte d'Ivoire": "civ",
  "Scotland": "sco",
  "Paraguay": "par",
  "Tunisia": "tun",
  "Uzbekistan": "uzb",
  "Bosnia": "bih",
  "Bosnia and Herzegovina": "bih",
  "Bosnia & Herzegovina": "bih",
  "Qatar": "qat",
  "Iraq": "irq",
  "South Africa": "rsa",
  "Saudi Arabia": "ksa",
  "Jordan": "jor",
  "Cabo Verde": "cpv",
  "Cape Verde": "cpv",
  "DR Congo": "cod",
  "Congo DR": "cod",
  "Ghana": "gha",
  "Curacao": "cuw",
  "Curaçao": "cuw",
  "Haiti": "hai",
  "New Zealand": "nzl",
};

function nameToTla(name: string): string | null {
  // Exact match first
  if (AF_NAME_TO_TLA[name]) return AF_NAME_TO_TLA[name];
  // Case-insensitive fallback
  const lower = name.toLowerCase();
  for (const [key, tla] of Object.entries(AF_NAME_TO_TLA)) {
    if (key.toLowerCase() === lower) return tla;
  }
  return null;
}

// ─── Raw API types ─────────────────────────────────────────────────────────
interface AfFixtureResponse {
  errors: Record<string, string> | string[];
  results: number;
  response: AfFixture[];
}

interface AfFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { id: number | null; name: string | null; city: string | null };
  };
  league: { id: number; round: string; group: string | null };
  teams: {
    home: { id: number; name: string; winner: boolean | null };
    away: { id: number; name: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    penalty: { home: number | null; away: number | null } | null;
  };
}

// ─── Public result types ────────────────────────────────────────────────────
export type AfVenueSyncResult =
  | { ok: false; reason: "no_token" }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "api_error"; status: number; body?: string }
  | { ok: false; reason: "api_errors"; errors: string }
  | {
      ok: true;
      /** homeTla:awayTla → venue name */
      venues: Map<string, string>;
      /** homeTla:awayTla → "venue name, city" */
      venueWithCity: Map<string, string>;
      fixtureCount: number;
      venueCount: number;
      /** Team name pairs that had a venue but couldn't be mapped to TLA codes */
      unmatchedNames: string[];
      requestsRemaining: number | null;
    };

/**
 * Fetches all World Cup fixtures from API-Football and returns a venue lookup map.
 * Uses 1 API request. Should be called at most once per day by an admin.
 *
 * Strategy (free tier only allows seasons 2022-2024 for league 1):
 *   1. Try /fixtures?league=1&season=2026  (works on paid plans)
 *   2. If blocked, fall back to /fixtures?live=all filtered for league 1
 *   3. If live=all returns 0 WC fixtures (no game in progress), fall back to
 *      /fixtures?league=1&date=YYYY-MM-DD for today + tomorrow (free-tier friendly)
 */
export async function fetchVenuesFromApiFootball(
  season = 2026
): Promise<AfVenueSyncResult> {
  if (!AF_TOKEN) return { ok: false, reason: "no_token" };

  const now = Date.now();
  if (now - lastCallAt < MIN_CALL_GAP_MS) return { ok: false, reason: "rate_limited" };
  lastCallAt = now;

  async function doFetch(path: string): Promise<Response> {
    return fetch(`${AF_BASE}${path}`, {
      headers: { "x-apisports-key": AF_TOKEN },
      cache: "no-store",
    });
  }

  // --- Attempt 1: full season query ---
  let resp: Response;
  try {
    resp = await doFetch(`/fixtures?league=${AF_WC_LEAGUE}&season=${season}`);
  } catch {
    return { ok: false, reason: "api_error", status: 0, body: "Network error" };
  }

  const requestsRemaining = resp.headers.get("x-ratelimit-requests-remaining");

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { ok: false, reason: "api_error", status: resp.status, body };
  }

  let data = (await resp.json()) as AfFixtureResponse;

  // API-Football returns plan errors in body even on HTTP 200
  const planBlocked = !Array.isArray(data.errors)
    && typeof data.errors === "object"
    && Object.keys(data.errors).length > 0;

  // --- Attempt 2: live fixtures fallback (free-tier friendly) ---
  if (planBlocked || data.results === 0) {
    try {
      const liveResp = await doFetch(`/fixtures?live=all`);
      if (liveResp.ok) {
        const liveData = (await liveResp.json()) as AfFixtureResponse;
        // Filter to World Cup (league 1) only
        liveData.response = (liveData.response ?? []).filter(
          (f) => f.league?.id === Number(AF_WC_LEAGUE)
        );
        liveData.results = liveData.response.length;
        if (liveData.results > 0) {
          data = liveData;
        }
      }
    } catch { /* ignore — proceed with whatever data we have */ }
  }

  // --- Attempt 3: date-based fallback (free-tier, no live games in progress) ---
  // Fetches today + tomorrow to capture all fixtures visible in the free plan.
  if (data.results === 0) {
    const today = new Date();
    const dates = [0, 1].map((offset) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    });
    for (const date of dates) {
      try {
        const dateResp = await doFetch(`/fixtures?league=${AF_WC_LEAGUE}&date=${date}`);
        if (dateResp.ok) {
          const dateData = (await dateResp.json()) as AfFixtureResponse;
          const hasResults = (dateData.response?.length ?? 0) > 0
            && (Array.isArray(dateData.errors) || Object.keys(dateData.errors ?? {}).length === 0);
          if (hasResults) {
            data = dateData;
            break;
          }
        }
      } catch { /* ignore */ }
    }
  }

  const fixtures = data.response ?? [];

  const venues = new Map<string, string>();
  const venueWithCity = new Map<string, string>();
  const unmatchedNames: string[] = [];

  for (const fix of fixtures) {
    const venueName = fix.fixture.venue?.name;
    if (!venueName) continue;

    const homeTla = nameToTla(fix.teams.home.name);
    const awayTla = nameToTla(fix.teams.away.name);

    if (!homeTla || !awayTla) {
      unmatchedNames.push(`${fix.teams.home.name} vs ${fix.teams.away.name}`);
      continue;
    }

    const key = `${homeTla}:${awayTla}`;
    venues.set(key, venueName);
    // Also store the reverse so home/away ordering differences are handled
    venues.set(`${awayTla}:${homeTla}`, venueName);

    const city = fix.fixture.venue?.city;
    const full = city ? `${venueName}, ${city}` : venueName;
    venueWithCity.set(key, full);
    venueWithCity.set(`${awayTla}:${homeTla}`, full);
  }

  return {
    ok: true,
    venues,
    venueWithCity,
    fixtureCount: fixtures.length,
    venueCount: venues.size / 2, // divided by 2 because we store both directions
    unmatchedNames,
    requestsRemaining: requestsRemaining !== null ? Number(requestsRemaining) : null,
  };
}
