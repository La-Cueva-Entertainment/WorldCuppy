import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pgPkg from "pg";

const { Pool } = pgPkg;

function parseArgs(argv) {
  const args = {
    email: null,
    leagueId: null,
    allLeagues: false,
    yes: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--email" && argv[i + 1]) {
      args.email = String(argv[++i]);
      continue;
    }
    if (a === "--league" && argv[i + 1]) {
      args.leagueId = String(argv[++i]);
      continue;
    }
    if (a === "--all-leagues") {
      args.allLeagues = true;
      continue;
    }
    if (a === "--yes") {
      args.yes = true;
      continue;
    }

    if (a === "-h" || a === "--help") {
      printHelpAndExit(0);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`\nClear a user's lineup picks (LineupPick rows).\n\nUsage:\n  node scripts/clear-lineup.mjs --email you@example.com [--league <leagueId> | --all-leagues] [--yes]\n\nBehavior:\n  - By default, clears picks only for the user's active league (User.activeLeagueId).\n  - Use --league to target a specific leagueId.\n  - Use --all-leagues to clear picks across all leagues for that user.\n  - Requires --yes to actually delete anything (otherwise it dry-runs).\n`);
  process.exit(code);
}

async function loadDotEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(here, "..", ".env");

  let raw;
  try {
    raw = await fs.readFile(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error("Missing --email");
    printHelpAndExit(2);
  }

  await loadDotEnvIfNeeded();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set (and .env could not be loaded).\n");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const email = args.email.toLowerCase().trim();

    const userRes = await pool.query(
      'select id, "activeLeagueId" as "activeLeagueId" from "User" where lower(email) = $1 limit 1',
      [email],
    );

    const user = userRes.rows[0];
    if (!user) {
      console.error(`No user found for email: ${email}`);
      process.exit(1);
    }

    const userId = String(user.id);
    const activeLeagueId = user.activeLeagueId ? String(user.activeLeagueId) : null;

    let leagueId = args.leagueId;
    if (!leagueId && !args.allLeagues) {
      leagueId = activeLeagueId;
    }

    if (!args.allLeagues && !leagueId) {
      console.error(
        `User ${email} has no activeLeagueId. Provide --league <leagueId> or --all-leagues.`,
      );
      process.exit(2);
    }

    const where = args.allLeagues
      ? { sql: '"userId" = $1', params: [userId] }
      : { sql: '"userId" = $1 and "leagueId" = $2', params: [userId, leagueId] };

    const countRes = await pool.query(
      `select count(*)::int as count from "LineupPick" where ${where.sql}`,
      where.params,
    );
    const count = Number(countRes.rows[0]?.count ?? 0);

    console.log(
      JSON.stringify(
        {
          email,
          userId,
          scope: args.allLeagues ? "all-leagues" : "single-league",
          leagueId: args.allLeagues ? null : leagueId,
          picksFound: count,
          willDelete: args.yes ? count : 0,
        },
        null,
        2,
      ),
    );

    if (!args.yes) {
      console.log("Dry run only. Re-run with --yes to delete.");
      return;
    }

    const delRes = await pool.query(
      `delete from "LineupPick" where ${where.sql}`,
      where.params,
    );

    console.log(`Deleted ${delRes.rowCount ?? 0} lineup pick(s).`);
    console.log(
      "Note: this does NOT reset draft state (LeagueDraft.currentPick/order).",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
