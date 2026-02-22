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

## Docker / Unraid

This app can run as a single container and connect to an existing PostgreSQL database (for example, a separate Postgres container on the same Unraid server).

### Build

Build from the `web/` folder:

```bash
cd web
docker build -t worldcuppy:latest .
```

### Run

```bash
docker run --rm -p 3000:3000 \
	-e DATABASE_URL="postgresql://USER:PASSWORD@192.168.2.100:5432/DBNAME?schema=public" \
	-e NEXTAUTH_SECRET="change-me" \
	-e NEXTAUTH_URL="https://worldcuppy.yourdomain.com" \
	worldcuppy:latest
```

Unraid networking note:

- If you run the app container with **Network Type: host**, you can use `localhost` in `DATABASE_URL` (since the container shares the host network).
- If you run with **bridge** networking, `localhost` will point at the app container itself. In that case, use your Unraid server's LAN IP (e.g. `192.168.x.x`) or put both containers on the same custom Docker network and use the Postgres container name as the host.

On startup the container runs `prisma migrate deploy` automatically. You can disable this with `SKIP_MIGRATIONS=1`.

### Publishing the image (GHCR)

This repo includes a GitHub Actions workflow that builds and pushes the Docker image to GHCR on every push to `main`:

- Image: `ghcr.io/la-cueva-entertainment/worldcuppy:latest`

After your next push to `main`, verify it exists from Unraid:

```bash
docker pull ghcr.io/la-cueva-entertainment/worldcuppy:latest
```

If the package is private, you must `docker login ghcr.io` on Unraid using a GitHub token with `read:packages`.

### Production DB setup (recommended)

Create a separate database for production (example names below). Run these using `psql` against your Postgres server (as a superuser like `postgres`):

```sql
-- create a dedicated app role
CREATE USER worldcuppy_app WITH PASSWORD 'CHANGE_ME';

-- create a dedicated production database
CREATE DATABASE worldcuppy_prod OWNER worldcuppy_app;

-- optional hardening
REVOKE ALL ON DATABASE worldcuppy_prod FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE worldcuppy_prod TO worldcuppy_app;
```

Then set your Unraid container environment variable:

```bash
DATABASE_URL="postgresql://worldcuppy_app:CHANGE_ME@192.168.2.100:5432/worldcuppy_prod?schema=public"
```
