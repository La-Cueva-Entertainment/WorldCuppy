import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchWorldCupMatches, getNextAllowedAt } from "@/lib/football-data";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await fetchWorldCupMatches();

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return NextResponse.json(
        { error: "Rate limited", nextAllowedAt: result.nextAllowedAt },
        { status: 429 }
      );
    }
    if (result.reason === "no_token") {
      return NextResponse.json({ error: "API token not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "API error", status: result.status }, { status: 502 });
  }

  // Find active/draft tournament to associate matches with
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!tournament) {
    return NextResponse.json({ updated: false, count: 0, reason: "no_active_tournament" });
  }

  let upserted = 0;
  for (const m of result.matches) {
    if (!m.homeTeam || !m.awayTeam) continue;

    await prisma.match.upsert({
      where: { externalId: m.externalId },
      create: {
        externalId: m.externalId,
        tournamentId: tournament.id,
        stage: m.stage,
        groupName: m.groupName,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        penaltyWinner: m.penaltyWinner,
        played: m.played,
        matchDate: m.matchDate,
        venue: m.venue,
      },
      update: {
        stage: m.stage,
        groupName: m.groupName,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        penaltyWinner: m.penaltyWinner,
        played: m.played,
        matchDate: m.matchDate,
        venue: m.venue,
      },
    });
    upserted++;
  }

  return NextResponse.json({
    updated: true,
    count: upserted,
    nextAllowedAt: getNextAllowedAt(),
    requestsRemaining: result.requestsRemaining,
  });
}
