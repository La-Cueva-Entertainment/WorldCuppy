# WorldCuppy

A friend-group football pool app for World Cup and Euros. Snake draft, live standings, and earnings tracking.

## Dev Setup

Requires Node 20+ and a PostgreSQL database.

1. Copy `.env.example` to `.env.local` and fill in the values
2. `npm install`
3. `npx prisma migrate deploy`
4. `npm run dev`

## Deployment (Unraid + Cloudflare Tunnel)

See `.env.example` for all required environment variables. The Docker image is published to GHCR on every push to `dev` or `main`.

## Team Data

To regenerate `lib/teams.ts` from the FIFA API:

```bash
npm run sync:teams
```
