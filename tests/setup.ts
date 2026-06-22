// Best-effort load of .env.local so DB-backed tests pick up DATABASE_URL when present.
// On an empty / missing file this is a no-op, and the integration tests skip themselves,
// keeping `npm test` green under the "runs on empty env" invariant.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (or unreadable) — fine; tests gate on process.env.DATABASE_URL.
}
