import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchVenuesFromRapidApi } from "@/lib/rapid-api";
import { fetchVenuesFromApiFootball } from "@/lib/api-football";
import { fetchVenuesFromFootballData } from "@/lib/football-data";
import { isSiteOwner } from "@/lib/siteOwner";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Require admin or site owner — venue sync burns API quota
  const siteOwner = isSiteOwner(session);
  if (!siteOwner) {
    const userId = session.user.id;
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let venues: Map<string, string> | null = null;
  let fixtureCount = 0;
  let venueCount = 0;
  let requestsRemaining: number | null = null;
  let source = "";

  // --- Attempt 1: RapidAPI FIFA feed (venue data for all 104 fixtures) ---
  const rapidResult = await fetchVenuesFromRapidApi();
  if (rapidResult.ok && rapidResult.venueCount > 0) {
    venues = rapidResult.venues;
    fixtureCount = rapidResult.fixtureCount;
    venueCount = rapidResult.venueCount;
    source = "FIFA/RapidAPI";
  }

  // --- Attempt 2: football-data.org (free, no quota concerns) ---
  if (!venues || venueCount === 0) {
    const fdResult = await fetchVenuesFromFootballData();
    if (fdResult.ok && fdResult.venueCount > 0) {
      venues = fdResult.venues;
      fixtureCount = fdResult.matchCount;
      venueCount = fdResult.venueCount;
      source = "football-data.org";
    }
  }

  // --- Attempt 3: API-Football (paid plan) ---
  if (!venues || venueCount === 0) {
    const afResult = await fetchVenuesFromApiFootball();
    if (afResult.ok && afResult.venueCount > 0) {
      venues = afResult.venues;
      fixtureCount = afResult.fixtureCount;
      venueCount = afResult.venueCount;
      requestsRemaining = afResult.requestsRemaining;
      source = "api-football.com";
    } else if (afResult.ok === false && afResult.reason === "rate_limited") {
      return NextResponse.json({ error: "Rate limited — wait at least 60s between syncs" }, { status: 429 });
    }
  }

  if (!venues || venueCount === 0) {
    return NextResponse.json({
      updated: 0,
      total: 0,
      fixtureCount: 0,
      venueCount: 0,
      source: "none",
      error: "No venue data available from any source",
    });
  }

  // Find the active/draft tournament
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ updated: 0, reason: "no_active_tournament", fixtureCount });
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, homeTeam: true, awayTeam: true },
  });

  let updated = 0;
  const missed: string[] = [];
  for (const match of matches) {
    const key = `${match.homeTeam}:${match.awayTeam}`;
    const venue = venues.get(key);
    if (venue) {
      await prisma.match.update({ where: { id: match.id }, data: { venue } });
      updated++;
    } else {
      missed.push(key);
    }
  }

  return NextResponse.json({
    updated,
    total: matches.length,
    fixtureCount,
    venueCount,
    source,
    requestsRemaining,
    unmatchedDbKeys: missed.slice(0, 10),
  });
}
