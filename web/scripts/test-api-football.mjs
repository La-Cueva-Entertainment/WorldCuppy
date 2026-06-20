/**
 * Test script for API-Football venue sync.
 * Usage (from web/ directory):
 *   $env:API_FOOTBALL_TOKEN="your_key_here"; node scripts/test-api-football.mjs
 *
 * Or with a .env.local key already set, just run:
 *   node scripts/test-api-football.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if present
try {
  const envPath = join(__dirname, "../.env.local");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* no .env.local, use container env */ }

const TOKEN = process.env.API_FOOTBALL_TOKEN;
if (!TOKEN) {
  console.error("❌  API_FOOTBALL_TOKEN not set.");
  console.error("    Run: $env:API_FOOTBALL_TOKEN='your_key'; node scripts/test-api-football.mjs");
  process.exit(1);
}

const BASE = "https://v3.football.api-sports.io";

async function get(path) {
  const url = `${BASE}${path}`;
  console.log(`→ GET ${url}`);
  const res = await fetch(url, { headers: { "x-apisports-key": TOKEN } });
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  const json = await res.json();
  console.log(`  HTTP ${res.status} | requests remaining: ${remaining ?? "unknown"}`);
  if (json.errors && (Array.isArray(json.errors) ? json.errors.length : Object.keys(json.errors).length)) {
    console.error("  API errors:", JSON.stringify(json.errors));
  }
  console.log(`  results: ${json.results}`);
  return json;
}

// 1. Check account status / subscription
console.log("\n── Account status ──────────────────────────────────");
const status = await get("/status");
console.log("  plan:", status.response?.subscription?.plan ?? "unknown");
console.log("  requests today:", status.response?.requests?.current, "/", status.response?.requests?.["limit-day"]);

// 2. Confirm league 1 (World Cup) exists for season 2026
console.log("\n── League 1 / season 2026 ──────────────────────────");
const league = await get("/leagues?id=1&season=2026");
if (league.results === 0) {
  console.error("  ❌  No league found for id=1, season=2026");
  console.log("  Trying without season filter...");
  const lg2 = await get("/leagues?id=1");
  const seasons = lg2.response?.[0]?.seasons?.map(s => s.year).slice(-5) ?? [];
  console.log("  Available seasons:", seasons.join(", ") || "none");
} else {
  const l = league.response?.[0]?.league;
  console.log(`  ✓  Found: ${l?.name} (${l?.type})`);
}

// 3. Fetch fixtures for WC 2026
console.log("\n── Fixtures (league=1, season=2026) ────────────────");
const fixtures = await get("/fixtures?league=1&season=2026");
console.log(`  fixture count: ${fixtures.results}`);
if (fixtures.results > 0) {
  const first = fixtures.response[0];
  console.log("  Sample fixture:");
  console.log("    home:", first.teams.home.name);
  console.log("    away:", first.teams.away.name);
  console.log("    venue:", first.fixture.venue?.name, "/", first.fixture.venue?.city);
  console.log("    status:", first.fixture.status?.short);
    const withVenue = fixtures.response.filter(f => f.fixture.venue?.name);
    console.log(`  fixtures with venue data: ${withVenue.length}/${fixtures.results}`);
  } else {
    console.error("  ❌  0 fixtures — free plan blocks season=2026. Trying live fallback...");

    const live = await get("/fixtures?live=all");
    const wcLive = (live.response ?? []).filter(f => f.league?.id === 1);
    console.log(`  Live WC fixtures right now: ${wcLive.length} (total live: ${live.results})`);
    if (wcLive.length > 0) {
      const f = wcLive[0];
      console.log("  ✓  Fallback works! Sample:");
      console.log("    ", f.teams.home.name, "vs", f.teams.away.name, "@", f.fixture.venue?.name);
    } else {
      console.log("  No WC matches live right now — try again during a match.");
      console.log("  The sync button will auto-populate venues when matches are live.");
    }
  }
