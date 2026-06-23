import { getBillingGateway } from "@/lib/gateway";
import { applyWebhookEvent } from "@/lib/billing-engine";

// Our subscription-billing webhook. Verifies the signature in the adapter, then applies the event
// idempotently. Runs on the Node runtime (Prisma) — no edge.
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const gateway = getBillingGateway();

  if (!gateway.verifyWebhook(raw, req.headers)) {
    return new Response("invalid signature", { status: 400 });
  }

  let event;
  try {
    event = gateway.parseEvent(raw);
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  // applyWebhookEvent is idempotent: a replayed event is a no-op (still 200).
  await applyWebhookEvent(event);
  return Response.json({ ok: true });
}
