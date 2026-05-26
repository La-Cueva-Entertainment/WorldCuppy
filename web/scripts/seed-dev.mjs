/**
 * seed-dev.mjs — populates your dev DB with a fake completed tournament.
 *
 * Usage (from web/ directory):
 *   node scripts/seed-dev.mjs
 *
 * Safe to run multiple times — clears the old seed tournament first.
 * Only touches rows created by this script (identified by tournament name).
 */

import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_TOURNAMENT_NAME = "[DEV SEED] World Cup 2026";

// Two fake users — you can log in as either
const USERS = [
  { email: "alice@dev.test", password: "password", name: "Alice" },
  { email: "bob@dev.test",   password: "password", name: "Bob" },
];

// Alice's 4 teams — includes the eventual champion (Brazil) + runner-up (France)
const ALICE_TEAMS = ["BRA", "FRA", "ESP", "ARG"];
// Bob's 4 teams
const BOB_TEAMS = ["ENG", "GER", "POR", "USA"];

// Full group-stage results for the seeded teams (other teams omitted for brevity)
const GROUP_MATCHES = [
  // Brazil
  { homeTeam: "BRA", awayTeam: "MEX",  homeScore: 3, awayScore: 0 },
  { homeTeam: "BRA", awayTeam: "CRO",  homeScore: 2, awayScore: 2 },
  { homeTeam: "BRA", awayTeam: "CMR",  homeScore: 1, awayScore: 0 },
  // France
  { homeTeam: "FRA", awayTeam: "AUS",  homeScore: 4, awayScore: 1 },
  { homeTeam: "FRA", awayTeam: "DEN",  homeScore: 2, awayScore: 1 },
  { homeTeam: "FRA", awayTeam: "TUN",  homeScore: 1, awayScore: 0 },
  // Spain
  { homeTeam: "ESP", awayTeam: "CRC",  homeScore: 7, awayScore: 0 },
  { homeTeam: "ESP", awayTeam: "GER",  homeScore: 1, awayScore: 1 },
  { homeTeam: "GER", awayTeam: "ESP",  homeScore: 2, awayScore: 1 }, // GER beats ESP
  // Argentina
  { homeTeam: "ARG", awayTeam: "POL",  homeScore: 2, awayScore: 0 },
  { homeTeam: "ARG", awayTeam: "MEX",  homeScore: 2, awayScore: 0 },
  { homeTeam: "ARG", awayTeam: "SAU",  homeScore: 1, awayScore: 2 }, // upset loss
  // England
  { homeTeam: "ENG", awayTeam: "IRN",  homeScore: 6, awayScore: 2 },
  { homeTeam: "ENG", awayTeam: "USA",  homeScore: 0, awayScore: 0 },
  { homeTeam: "ENG", awayTeam: "WAL",  homeScore: 3, awayScore: 0 },
  // Germany
  { homeTeam: "GER", awayTeam: "JPN",  homeScore: 1, awayScore: 2 },
  { homeTeam: "GER", awayTeam: "CRC",  homeScore: 4, awayScore: 2 },
  // Portugal
  { homeTeam: "POR", awayTeam: "GHA",  homeScore: 3, awayScore: 2 },
  { homeTeam: "POR", awayTeam: "URU",  homeScore: 2, awayScore: 0 },
  { homeTeam: "POR", awayTeam: "KOR",  homeScore: 1, awayScore: 2 },
  // USA
  { homeTeam: "USA", awayTeam: "WAL",  homeScore: 1, awayScore: 1 },
  { homeTeam: "USA", awayTeam: "IRN",  homeScore: 1, awayScore: 0 },
];

// Knockout stage — a full bracket ending BRA champion, FRA runner-up
const KNOCKOUT_MATCHES = [
  // R16
  { stage: "r16", homeTeam: "BRA", awayTeam: "KOR", homeScore: 4, awayScore: 1 },
  { stage: "r16", homeTeam: "FRA", awayTeam: "POL", homeScore: 3, awayScore: 1 },
  { stage: "r16", homeTeam: "ARG", awayTeam: "AUS", homeScore: 2, awayScore: 1 },
  { stage: "r16", homeTeam: "ENG", awayTeam: "SEN", homeScore: 3, awayScore: 0 },
  { stage: "r16", homeTeam: "ESP", awayTeam: "MAR", homeScore: 0, awayScore: 0, penaltyWinner: "MAR" },
  { stage: "r16", homeTeam: "POR", awayTeam: "SUI", homeScore: 6, awayScore: 1 },
  { stage: "r16", homeTeam: "GER", awayTeam: "URU", homeScore: 2, awayScore: 1 },
  { stage: "r16", homeTeam: "USA", awayTeam: "NED", homeScore: 3, awayScore: 1 },
  // QF
  { stage: "qf", homeTeam: "BRA", awayTeam: "FRA", homeScore: 1, awayScore: 1, penaltyWinner: "BRA" },
  { stage: "qf", homeTeam: "ARG", awayTeam: "ENG", homeScore: 2, awayScore: 1 },
  { stage: "qf", homeTeam: "MAR", awayTeam: "POR", homeScore: 1, awayScore: 0 },
  { stage: "qf", homeTeam: "GER", awayTeam: "USA", homeScore: 2, awayScore: 2, penaltyWinner: "USA" },
  // SF
  { stage: "sf", homeTeam: "BRA", awayTeam: "ARG", homeScore: 3, awayScore: 0 },
  { stage: "sf", homeTeam: "FRA", awayTeam: "USA", homeScore: 2, awayScore: 1 },
  // 3rd place
  { stage: "3rd", homeTeam: "ARG", awayTeam: "USA", homeScore: 2, awayScore: 1 },
  // Final
  { stage: "final", homeTeam: "BRA", awayTeam: "FRA", homeScore: 3, awayScore: 1 },
];

async function main() {
  console.log("🌱 Seeding dev database...\n");

  // Clean up previous seed
  const existing = await prisma.tournament.findFirst({ where: { name: SEED_TOURNAMENT_NAME } });
  if (existing) {
    await prisma.tournament.delete({ where: { id: existing.id } });
    console.log("  Removed old seed tournament.");
  }

  // Upsert fake users
  const userIds = {};
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash: hash },
    });
    userIds[u.email] = user.id;
    console.log(`  User: ${u.email} (id: ${user.id})`);
  }

  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      name: SEED_TOURNAMENT_NAME,
      type: "world_cup",
      year: 2026,
      teamsPerPlayer: 4,
      status: "complete",
    },
  });
  console.log(`\n  Tournament: ${tournament.id}`);

  // Assign picks
  const allPicks = [
    ...ALICE_TEAMS.map((teamCode, i) => ({ userId: userIds["alice@dev.test"], teamCode, pickNumber: i + 1 })),
    ...BOB_TEAMS.map((teamCode, i) => ({ userId: userIds["bob@dev.test"],   teamCode, pickNumber: i + 5 })),
  ];
  await prisma.lineupPick.createMany({
    data: allPicks.map((p) => ({ ...p, tournamentId: tournament.id })),
  });
  console.log(`  Created ${allPicks.length} lineup picks.`);

  // Insert group matches
  const groupRows = GROUP_MATCHES.map((m) => ({
    tournamentId: tournament.id,
    stage: "group",
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    played: true,
  }));
  await prisma.match.createMany({ data: groupRows });
  console.log(`  Created ${groupRows.length} group matches.`);

  // Insert knockout matches
  const knockoutRows = KNOCKOUT_MATCHES.map((m) => ({
    tournamentId: tournament.id,
    stage: m.stage,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    penaltyWinner: m.penaltyWinner ?? null,
    played: true,
  }));
  await prisma.match.createMany({ data: knockoutRows });
  console.log(`  Created ${knockoutRows.length} knockout matches.`);

  console.log("\n✅ Done! Log in with:");
  console.log("   alice@dev.test / password  (BRA, FRA, ESP, ARG)");
  console.log("   bob@dev.test   / password  (ENG, GER, POR, USA)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
