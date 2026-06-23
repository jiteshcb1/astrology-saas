import { describe, expect, it } from "vitest";
import { buildCheckoutSummary, totalSeatCount } from "../lib/checkout";
import { computeEffectivePrice } from "../lib/money";

const plan = {
  name: "Pro",
  price: 49900,
  currency: "INR",
  billingInterval: "monthly" as const,
  includedSeats: 2,
  perSeatPrice: 19900,
  features: { teams: true, sms: false },
};

describe("checkout seat mapping (SP-1.8)", () => {
  it("totalSeatCount = includedSeats + additionalSeats (clamps negatives)", () => {
    expect(totalSeatCount(2, 3)).toBe(5);
    expect(totalSeatCount(2, 0)).toBe(2);
    expect(totalSeatCount(2, -4)).toBe(2);
  });

  it("summary total === computeEffectivePrice(plan, includedSeats + additionalSeats)", () => {
    for (const additional of [0, 1, 5, 20]) {
      const summary = buildCheckoutSummary(plan, additional);
      expect(summary.totalPaise).toBe(computeEffectivePrice(plan, plan.includedSeats + additional));
    }
  });

  it("breaks out base + additional line items and only enabled features", () => {
    const s = buildCheckoutSummary(plan, 3);
    expect(s.basePaise).toBe(49900);
    expect(s.additionalSeats).toBe(3);
    expect(s.perSeatPaise).toBe(19900);
    expect(s.additionalPaise).toBe(3 * 19900);
    expect(s.totalPaise).toBe(49900 + 3 * 19900);
    expect(s.includedSeats).toBe(2);
    expect(s.features).toEqual(["teams"]);
  });
});
