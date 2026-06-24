import { timingSafeEqual } from "node:crypto";
import { expireHoldsCore } from "@/lib/scheduling";

// Hold-expiry sweep entry point (SP-4.2). Housekeeping: frees held/pending_payment slots whose hold
// window lapsed (lazy expiry in reserveSlot/getAvailableSlots is the correctness path). Protected by a
// shared secret (x-cron-secret); the Cloudflare Cron Trigger schedule is wired in wrangler.jsonc later.
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
  const result = await expireHoldsCore();
  return Response.json(result);
}
