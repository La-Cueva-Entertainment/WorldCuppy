import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Server-side guard: even if the client fires faster than intended,
// we won't call football-data.org more than ~10/min (one call per 5.5s per tournament).
const SYNC_COOLDOWN_MS = 5_500;
const lastSyncAt = new Map<string, number>(); // tournamentId → epoch ms

// Fallback: derive competition code from tournament type if apiCode not stored
const TYPE_TO_CODE: Record<string, string> = {
  world_cup:          "WC",
  euros:              "EC",
  champions_league:   "CL",
  copa_libertadores:  "CLI",
};

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE:    "group",
  LAST_32:        "r32",
  LAST_16:        "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS:    "sf",
  THIRD_PLACE:    "3rd",
  FINAL:          "final",
};

// football-data.org TLA → our internal code (only where they differ)
const TLA_OVERRIDES: Record<string, string> = {
  IRI: "irn", // Iran
  USA: "usa",
  KSA: "ksa",
  RSA: "rsa",
  CPV: "cpv",
  CUW: "cuw",
};

function tlaToCode(tla: string): string {
  const upper = tla.toUpperCase();
  return TLA_OVERRIDES[upper] ?? tla.toLowerCase();
}

type FDMatch = {
  id: number;
  stage: string;
  group: string | null;
  status: string;
  utcDate: string;
  homeTeam: { tla: string };
  awayTeam: { tla: string };
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    penalties: { home: number | null; away: number | null };
  };
};

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FOOTBALL_DATA_API_KEY is not set" }, { status: 500 });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "active"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!tournament) {
    return NextResponse.json({ error: "No active tournament found" }, { status: 404 });
  }

  // Server-side cooldown — return early if called faster than the budget allows
  const now = Date.now();
  const last = lastSyncAt.get(tournament.id) ?? 0;
  if (now - last < SYNC_COOLDOWN_MS) {
    return NextResponse.json({ ok: true, cached: true, nextSyncMs: SYNC_COOLDOWN_MS - (now - last) });
  }
  lastSyncAt.set(tournament.id, now);

  const competitionCode = tournament.apiCode ?? TYPE_TO_CODE[tournament.type];
  if (!competitionCode) {
    return NextResponse.json({ error: `No API code configured for tournament type: ${tournament.type}` }, { status: 400 });
  }

  const season = tournament.apiSeason ?? tournament.year;
  const url = `https://api.football-data.org/v4/competitions/${competitionCode}/matches?season=${season}`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": apiKey },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `football-data.org responded with ${res.status}`, detail: text },
      { status: 502 },
    );
  }

  const data = await res.json() as { matches: FDMatch[] };
  const apiMatches = data.matches ?? [];

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const unknownTeams: string[] = [];

  for (const m of apiMatches) {
    const stage = STAGE_MAP[m.stage];
    if (!stage) { skipped++; continue; }

    const homeCode = tlaToCode(m.homeTeam.tla);
    const awayCode = tlaToCode(m.awayTeam.tla);
    const matchDate = m.utcDate ? new Date(m.utcDate) : null;
    const isFinished = m.status === "FINISHED";

    const homeScore = isFinished ? (m.score.fullTime.home ?? 0) : null;
    const awayScore = isFinished ? (m.score.fullTime.away ?? 0) : null;

    let penaltyWinner: string | null = null;
    if (isFinished && m.score.duration === "PENALTY_SHOOTOUT" && m.score.winner) {
      penaltyWinner = m.score.winner === "HOME_TEAM" ? homeCode : awayCode;
    }

    const groupName = m.group ? m.group.replace(/^GROUP_/, "") : null;

    const existing = await prisma.match.findFirst({
      where: { tournamentId: tournament.id, homeTeam: homeCode, awayTeam: awayCode },
      select: { id: true, played: true },
    });

    if (existing) {
      const shouldUpdate = !existing.played && isFinished;
      if (shouldUpdate || matchDate) {
        await prisma.match.update({
          where: { id: existing.id },
          data: {
            ...(matchDate ? { matchDate } : {}),
            ...(isFinished ? { homeScore, awayScore, penaltyWinner, played: true } : {}),
          },
        });
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Track unknown team codes so admin can investigate
      if (!homeCode || !awayCode) {
        unknownTeams.push(`${m.homeTeam.tla} vs ${m.awayTeam.tla}`);
        skipped++;
        continue;
      }
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          stage,
          groupName,
          homeTeam: homeCode,
          awayTeam: awayCode,
          matchDate,
          played: isFinished,
          homeScore,
          awayScore,
          penaltyWinner,
        },
      });
      created++;
    }
  }

  return NextResponse.json({
    ok: true,
    tournament: `${tournament.name} ${tournament.year}`,
    total: apiMatches.length,
    created,
    updated,
    skipped,
    ...(unknownTeams.length ? { unknownTeams } : {}),
  });
}
