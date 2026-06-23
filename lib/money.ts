import type { SubscriptionPlan } from "@prisma/client";

// Pure money helpers — NO server imports, so these are safe to use in client components
// (e.g. the live checkout summary) AND on the server (billing). All money is integer paise.

export function computeEffectivePrice(
  plan: Pick<SubscriptionPlan, "price" | "includedSeats" | "perSeatPrice">,
  seatCount: number,
): number {
  const extraSeats = Math.max(0, Math.trunc(seatCount) - plan.includedSeats);
  return plan.price + extraSeats * plan.perSeatPrice;
}

export function formatMoney(paise: number, currency = "INR"): string {
  const major = paise / 100;
  const amount = major.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "INR" ? `₹${amount}` : `${currency} ${amount}`;
}

export function parseFeatures(raw: string): Record<string, boolean> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Features must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Features must be a JSON object of key → true/false.");
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "boolean") throw new Error(`Feature "${key}" must be true or false.`);
    out[key] = value;
  }
  return out;
}
