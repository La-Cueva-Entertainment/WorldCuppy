#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

# Optional but strongly recommended for NextAuth
if [ -z "${NEXTAUTH_SECRET:-}" ]; then
  echo "WARN: NEXTAUTH_SECRET is not set (recommended in production)" >&2
fi

# Wait for Postgres to be reachable
if [ "${SKIP_DB_WAIT:-0}" != "1" ]; then
  echo "Waiting for database..."
  node <<'NODE'
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
const maxSeconds = Number.parseInt(process.env.DB_WAIT_SECONDS || '60', 10) || 60;
const deadline = Date.now() + maxSeconds * 1000;

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

(async () => {
  while (true) {
    try {
      const client = new Client({ connectionString: url });
      await client.connect();
      await client.query('select 1');
      await client.end();
      process.exit(0);
    } catch (e) {
      if (Date.now() > deadline) {
        console.error('Database not reachable within timeout:', e?.message || e);
        process.exit(1);
      }
      await sleep(2000);
    }
  }
})();
NODE
fi

# Run migrations (safe to run on each start)
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy --schema prisma/schema.prisma
fi

echo "Starting app..."
exec "$@"
