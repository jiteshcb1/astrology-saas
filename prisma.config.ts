import { defineConfig } from "prisma/config";

// Prisma 7 moves the connection URL out of schema.prisma and into this config.
// The URL is only needed for Migrate / introspection commands (e.g. `prisma migrate dev`);
// at runtime the PrismaClient is constructed with the Neon driver adapter (see lib/db.ts).
//
// NOTE: Prisma 7 no longer auto-loads .env. For migration commands, load it first, e.g.:
//   node --env-file=.env.local node_modules/.bin/prisma migrate dev
// (the `prisma:migrate` npm script does this).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Blank until the user fills DATABASE_URL; undefined-safe so validate/generate work.
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: "prisma/migrations",
  },
});
