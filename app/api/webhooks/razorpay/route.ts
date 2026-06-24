import { getPaymentMethod } from "@/lib/payments";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/razorpay";
import { applyPaymentWebhookEvent } from "@/lib/payment";

// Razorpay webhook (SP-4.3) — secondary/idempotent confirm path (the checkout callback is primary).
// Mirrors the SP-1.6 billing webhook: read RAW body → verify signature BEFORE trusting the payload →
// apply idempotently (PaymentEvent.gatewayEventId @unique). BYO-keys: each consultant configures their
// own webhook with their own secret, so we select the candidate secret by the order's notes.orgId
// (untrusted, used ONLY to look up the secret) and then HMAC-verify — a forged orgId can't pass.
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const eventId = req.headers.get("x-razorpay-event-id") ?? "";
  if (!signature || !eventId) return new Response("missing signature", { status: 400 });

  // Peek at notes.orgId to choose which consultant's webhook secret to verify against.
  let orgId = "";
  try {
    const obj = JSON.parse(raw) as { payload?: { payment?: { entity?: { notes?: { orgId?: string } } } } };
    orgId = obj.payload?.payment?.entity?.notes?.orgId ?? "";
  } catch {
    return new Response("invalid payload", { status: 400 });
  }
  if (!orgId || !isEncryptionConfigured()) return new Response("unverifiable", { status: 400 });

  const pm = await getPaymentMethod(orgId);
  if (!pm?.gatewayWebhookSecretEnc) return new Response("unverifiable", { status: 400 });
  const secret = decryptSecret(pm.gatewayWebhookSecretEnc);

  if (!verifyWebhookSignature(raw, signature, secret)) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = parseWebhookEvent(raw, eventId);
  const result = await applyPaymentWebhookEvent(orgId, event);
  return Response.json(result);
}
