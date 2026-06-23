import { timingSafeEqual } from "node:crypto";
import { runGraceSweep } from "@/lib/billing-engine";

// Dunning sweep entry point. Protected by a shared secret (x-cron-secret). The Cloudflare Cron
// Trigger schedule that calls this is deferred (wired in wrangler.jsonc later); the logic is here
// and tested via runGraceSweep().
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
  const result = await runGraceSweep();
  return Response.json(result);
}
