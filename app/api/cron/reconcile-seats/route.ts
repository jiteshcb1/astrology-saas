import { timingSafeEqual } from "node:crypto";
import { reconcileSeatsCore } from "@/lib/seats";

// SP-5.4 seat reconciliation sweep. Recounts active billable members per org and fixes any seatCount drift
// (idempotent). Protected by a shared secret (x-cron-secret); the Cloudflare Cron Trigger schedule is wired
// in wrangler.jsonc later (consistent with billing-dunning / expire-holds). Internal-only.
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
  const result = await reconcileSeatsCore();
  return Response.json(result);
}
