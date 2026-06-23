import type { SubscriptionPlan } from "@prisma/client";
import { computeEffectivePrice } from "@/lib/money";

// Checkout summary shape + builder. Pure + client-safe. SP-4 will reuse buildCheckoutSummary to
// render the invite email; the live UI (CheckoutSummary) renders the same data.
//
// SEAT MAPPING: the operator enters ADDITIONAL seats (beyond what the plan includes); the billing
// total is always computed for the TOTAL seat count = includedSeats + additionalSeats.

export function totalSeatCount(includedSeats: number, additionalSeats: number): number {
  return includedSeats + Math.max(0, Math.trunc(additionalSeats));
}

export interface CheckoutSummaryData {
  planName: string;
  interval: string;
  includedSeats: number;
  features: string[]; // enabled feature keys
  basePaise: number;
  additionalSeats: number;
  perSeatPaise: number;
  additionalPaise: number;
  totalPaise: number;
  currency: string;
}

type PlanForCheckout = Pick<
  SubscriptionPlan,
  "name" | "price" | "currency" | "billingInterval" | "includedSeats" | "perSeatPrice" | "features"
>;

export function buildCheckoutSummary(
  plan: PlanForCheckout,
  additionalSeats: number,
): CheckoutSummaryData {
  const additional = Math.max(0, Math.trunc(additionalSeats));
  const total = totalSeatCount(plan.includedSeats, additional);
  const featureMap = (plan.features ?? {}) as Record<string, unknown>;
  const features = Object.entries(featureMap)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  return {
    planName: plan.name,
    interval: plan.billingInterval,
    includedSeats: plan.includedSeats,
    features,
    basePaise: plan.price,
    additionalSeats: additional,
    perSeatPaise: plan.perSeatPrice,
    additionalPaise: additional * plan.perSeatPrice,
    // Must equal computeEffectivePrice(plan, includedSeats + additionalSeats) — the billing source of truth.
    totalPaise: computeEffectivePrice(plan, total),
    currency: plan.currency,
  };
}
