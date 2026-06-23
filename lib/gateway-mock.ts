import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { BillingGateway, CreateSubscriptionParams, GatewayWebhookEvent } from "@/lib/gateway";

// Mock billing gateway: stands in for Razorpay/Stripe behind the BillingGateway interface.
// Real signature verification is genuinely exercised here (HMAC-SHA256), so swapping in the real
// provider only changes the scheme/header inside this class — nothing in the engine.

const SIGNATURE_HEADER = "x-mock-signature";

/** Test/dev helper: produce the signature a caller must send. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export class MockBillingGateway implements BillingGateway {
  async createSubscription(p: CreateSubscriptionParams) {
    const days = p.interval === "yearly" ? 365 : 30;
    return {
      gatewaySubscriptionRef: `mock_sub_${randomUUID()}`,
      currentPeriodEnd: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
  }

  async cancelSubscription(): Promise<void> {
    // no-op for the mock
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    // Read at call time (not the env snapshot) so rotation/tests work without re-import.
    const secret = process.env.BILLING_WEBHOOK_SECRET ?? "";
    if (!secret) return false; // never accept unverifiable webhooks
    const provided = headers.get(SIGNATURE_HEADER) ?? "";
    const expected = signPayload(rawBody, secret);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  parseEvent(rawBody: string): GatewayWebhookEvent {
    const obj = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      id: String(obj.id),
      type: obj.type as GatewayWebhookEvent["type"],
      subscriptionRef: String(obj.subscriptionRef),
      amount: typeof obj.amount === "number" ? obj.amount : undefined,
      currency: typeof obj.currency === "string" ? obj.currency : undefined,
    };
  }
}
