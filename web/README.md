# WorldCuppy — web

Next.js app for the WorldCuppy fantasy soccer draft. See the [root README](../README.md) for Docker/Unraid deployment instructions.

## Getting Started

```bash
cp .env.example .env   # then fill in your values
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## League Recovery (Site Owner)

League deletion is a **soft delete** (recoverable).

To enable recovery tools, set `SITE_OWNER_EMAILS` in your `.env` (comma/space separated):

```bash
SITE_OWNER_EMAILS=you@example.com,otheradmin@example.com
```

When signed in with one of those emails, the dashboard shows a **Deleted leagues** section with a **Restore league** button.

## Bovada Odds → Current Prices

The dashboard uses a local odds file to compute **current** team prices (and therefore tiers).

- Edit [data/bovada-odds.json](data/bovada-odds.json) to map team name → American odds.
- Or, copy Bovada's odds table into a text file (one team per line like `Spain +450`) and run:
	- `node scripts/import-bovada-odds.mjs --in data/bovada-odds.txt --out data/bovada-odds.json`

See [data/bovada-odds.example.json](data/bovada-odds.example.json) for the expected shape.
