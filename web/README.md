This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
