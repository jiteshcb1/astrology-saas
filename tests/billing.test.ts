import { describe, expect, it } from "vitest";
import { computeEffectivePrice, formatMoney, parseFeatures } from "../lib/billing";

const plan = (over: Partial<{ price: number; includedSeats: number; perSeatPrice: number }> = {}) => ({
  price: 49900,
  includedSeats: 1,
  perSeatPrice: 19900,
  ...over,
});

describe("computeEffectivePrice", () => {
  it("returns the base when seats are within the included allowance", () => {
    expect(computeEffectivePrice(plan(), 1)).toBe(49900);
    expect(computeEffectivePrice(plan(), 0)).toBe(49900);
  });

  it("adds per-seat price for seats beyond included", () => {
    expect(computeEffectivePrice(plan(), 3)).toBe(49900 + 2 * 19900); // 89700
    expect(computeEffectivePrice(plan({ includedSeats: 2 }), 5)).toBe(49900 + 3 * 19900);
  });

  it("ignores per-seat price when it is zero", () => {
    expect(computeEffectivePrice(plan({ perSeatPrice: 0 }), 100)).toBe(49900);
  });

  it("always returns an integer (paise)", () => {
    for (const seats of [1, 2, 7, 99]) {
      expect(Number.isInteger(computeEffectivePrice(plan(), seats))).toBe(true);
    }
  });
});

describe("formatMoney", () => {
  it("formats INR with the rupee symbol and 2 decimals", () => {
    expect(formatMoney(49900)).toBe("₹499.00");
    expect(formatMoney(49950)).toBe("₹499.50");
    expect(formatMoney(100000)).toBe("₹1,000.00");
  });

  it("prefixes other currencies with the code", () => {
    expect(formatMoney(100000, "USD")).toBe("USD 1,000.00");
  });
});

describe("parseFeatures", () => {
  it("returns an empty map for blank input", () => {
    expect(parseFeatures("")).toEqual({});
    expect(parseFeatures("  ")).toEqual({});
  });

  it("parses a key→boolean object", () => {
    expect(parseFeatures('{"teams":true,"sms":false}')).toEqual({ teams: true, sms: false });
  });

  it("rejects invalid JSON, arrays, and non-boolean values", () => {
    expect(() => parseFeatures("not json")).toThrow();
    expect(() => parseFeatures("[1,2]")).toThrow();
    expect(() => parseFeatures('{"a":1}')).toThrow();
  });
});
