import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const adapter = new PrismaPg(pool);

const cached = globalForPrisma.prisma;

// In dev, the globally cached Prisma Client instance can survive hot reloads.
// If the schema/client changes (e.g., new models), the cached instance may be
// missing the new model delegates. Recreate the client in that case.
const needsRefresh =
  process.env.NODE_ENV !== "production" &&
  cached &&
  (typeof (cached as unknown as Record<string, unknown>).leagueMember ===
    "undefined" ||
    typeof (cached as unknown as Record<string, unknown>).teamPoints ===
      "undefined" ||
    typeof (cached as unknown as Record<string, unknown>).teamPriceOverride ===
      "undefined");

export const prisma = needsRefresh ? new PrismaClient({ adapter }) : cached ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
