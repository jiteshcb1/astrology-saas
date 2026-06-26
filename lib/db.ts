import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Prisma 7 runs in query-compiler mode and requires a driver adapter at runtime.
// We use the Neon serverless driver (WebSocket pool) so this works on the Cloudflare
// Workers / Node-compat runtime that OpenNext targets.
//
// NOTE: the adapter is constructed even when DATABASE_URL is blank — it does not connect
// until the first query, so importing this module is safe with empty env. Queries will of
// course fail until DATABASE_URL is set.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Interactive transactions make several sequential round-trips to remote Neon; the Prisma default 5s ceiling
// is tight under load (and across files in the test suite). Give tenantTransaction more headroom.
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter, transactionOptions: { timeout: 20_000, maxWait: 10_000 } });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
