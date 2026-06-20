import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchVenuesFromApiFootball } from "@/lib/api-football";
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

  const result = await fetchVenuesFromApiFootball();

  if (!result.ok) {
    if (result.reason === "no_token")
      return NextResponse.json({ error: "API_FOOTBALL_TOKEN not configured" }, { status: 503 });
    if (result.reason === "rate_limited")
      return NextResponse.json({ error: "Rate limited — wait at least 60s between syncs" }, { status: 429 });
    return NextResponse.json({ error: `API error ${result.status}`, body: result.body }, { status: 502 });
  }

  // Find the active/draft tournament
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ updated: 0, reason: "no_active_tournament", fixtureCount: result.fixtureCount });
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    select: { id: true, homeTeam: true, awayTeam: true },
  });

  let updated = 0;
  const missed: string[] = [];
  for (const match of matches) {
    const key = `${match.homeTeam}:${match.awayTeam}`;
    const venue = result.venues.get(key);
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
    fixtureCount: result.fixtureCount,
    venueCount: result.venueCount,
    requestsRemaining: result.requestsRemaining,
    // Diagnostics — show in button tooltip if updated=0
    unmatchedApiNames: result.unmatchedNames.slice(0, 10),
    unmatchedDbKeys: missed.slice(0, 10),
  });
}
