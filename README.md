# World Cuppy

The Next.js app lives in `web/`.

## Quick start

```bash
cd web
npm install
npm run dev
```

## Environment

Copy `web/.env.example` to `web/.env` and fill in:
- `DATABASE_URL` (PostgreSQL)
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional)

## Database

After setting `DATABASE_URL`:

```bash
cd web
npx prisma generate
npx prisma migrate dev --name init
```
