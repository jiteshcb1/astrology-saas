// Razorpay adapter (no SDK — REST + node:crypto). BYO-keys: every call uses the CONSULTANT's own keys,
// so funds settle to their account and the platform never touches money. Keys are used only for the
// Basic-auth header / HMAC here; they are never logged and never returned — only verdicts/refs leave.
//
// SP-2.4: testConnection (credential check). SP-4.3: createOrder + signature verification (checkout +
// webhook). All callers must decrypt secrets (lib/crypto.ts) ONLY at charge time, server-side.

import { createHmac, timingSafeEqual } from "node:crypto";

export interface RazorpayTestResult {
  ok: boolean;
  message: string;
}

export async function testConnection(keyId: string, keySecret: string): Promise<RazorpayTestResult> {
  if (!keyId.trim() || !keySecret.trim()) return { ok: false, message: "Missing key id or secret." };
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    // A read-only, side-effect-free endpoint: lists recent payments (count=1).
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true, message: "Keys verified." };
    if (res.status === 401) return { ok: false, message: "Razorpay rejected these keys." };
    return { ok: false, message: "Could not verify keys. Please try again." };
  } catch {
    // Network/other failure — fail closed, leak nothing.
    return { ok: false, message: "Could not reach Razorpay. Please try again." };
  }
}

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; message: string };

// Create an order on the consultant's Razorpay account (REST POST /v1/orders). amount in paise.
export async function createOrder(
  keyId: string,
  keySecret: string,
  params: { amount: number; currency?: string; receipt?: string; notes?: Record<string, string> },
): Promise<CreateOrderResult> {
  if (!keyId.trim() || !keySecret.trim()) return { ok: false, message: "Missing key id or secret." };
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency ?? "INR",
        receipt: params.receipt,
        notes: params.notes,
      }),
    });
    if (!res.ok) {
      if (res.status === 401) return { ok: false, message: "Razorpay rejected the consultant's keys." };
      return { ok: false, message: "Could not create the payment order. Please try again." };
    }
    const body = (await res.json()) as { id?: string };
    if (!body.id) return { ok: false, message: "Razorpay returned no order id." };
    return { ok: true, orderId: body.id };
  } catch {
    return { ok: false, message: "Could not reach Razorpay. Please try again." };
  }
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Verify a Razorpay Checkout success callback: HMAC_SHA256(order_id|payment_id, key_secret) === signature.
export function verifyCheckoutSignature(keySecret: string, orderId: string, paymentId: string, signature: string): boolean {
  if (!keySecret || !orderId || !paymentId || !signature) return false;
  return timingSafeEqualHex(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

// Verify a Razorpay webhook: HMAC_SHA256(rawBody, webhookSecret) === X-Razorpay-Signature.
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  if (!webhookSecret || !signature) return false;
  return timingSafeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}

export interface RazorpayWebhookEvent {
  id: string; // x-razorpay-event-id (idempotency key)
  type: string; // e.g. "payment.captured"
  orderId: string | null;
  paymentId: string | null;
  amount: number | null;
}

// Parse the relevant fields from a Razorpay webhook body. Only called AFTER signature verification.
export function parseWebhookEvent(rawBody: string, eventId: string): RazorpayWebhookEvent {
  const obj = JSON.parse(rawBody) as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
  };
  const entity = obj.payload?.payment?.entity;
  return {
    id: eventId,
    type: String(obj.event ?? ""),
    orderId: entity?.order_id ?? null,
    paymentId: entity?.id ?? null,
    amount: typeof entity?.amount === "number" ? entity.amount : null,
  };
}
