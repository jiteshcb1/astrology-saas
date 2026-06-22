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

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
