import { timingSafeEqual } from "node:crypto";

// SP-6.4 — deliberate-error endpoint to verify Sentry captures production errors. Guarded by the same
// shared secret as the cron routes (x-cron-secret == BILLING_CRON_SECRET, timing-safe), so only an operator
// with the secret can trigger it. Throwing here surfaces via Sentry's onRequestError hook (instrumentation.ts).
// Safe to remove once Sentry is verified in production.
function secretOk(provided: string, expected: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const expected = process.env.BILLING_CRON_SECRET ?? "";
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!secretOk(provided, expected)) {
    return new Response("unauthorized", { status: 401 });
  }
  throw new Error("SP-6.4 deliberate Sentry test error — production monitoring check");
}
