import { MockBillingGateway } from "@/lib/gateway-mock";

// Billing gateway boundary. Billing logic depends ONLY on this interface, so swapping the mock for
// a real Razorpay/Stripe adapter later means changing only getBillingGateway() — no engine changes.

export type GatewayEventType =
  | "subscription.charged"
  | "subscription.payment_failed"
  | "subscription.canceled";

export interface GatewayWebhookEvent {
  id: string; // gateway event id — the idempotency dedup key
  type: GatewayEventType;
  subscriptionRef: string;
  amount?: number; // paise (for charged)
  currency?: string;
}

export interface CreateSubscriptionParams {
  orgId: string;
  planId: string;
  seatCount: number;
  amount: number; // paise
  currency: string;
  interval: "monthly" | "yearly";
}

export interface BillingGateway {
  createSubscription(
    p: CreateSubscriptionParams,
  ): Promise<{ gatewaySubscriptionRef: string; currentPeriodEnd: Date }>;
  cancelSubscription(ref: string): Promise<void>;
  /** Verify the webhook is genuinely from the gateway (reads the gateway's own signature header). */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseEvent(rawBody: string): GatewayWebhookEvent;
}

let instance: BillingGateway | null = null;

export function getBillingGateway(): BillingGateway {
  // Swap this line for `new RazorpayBillingGateway()` when the real adapter lands.
  if (!instance) instance = new MockBillingGateway();
  return instance;
}
