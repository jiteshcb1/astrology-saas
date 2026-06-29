import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { promoActive, planDiscount, istToday, getPromo, savePromoCore, type Promo } from "../lib/promo";

// ── Pure (always-on) ─────────────────────────────────────────────────────────
describe("promo pure helpers", () => {
  const base: Promo = { enabled: true, name: "Father's Day Offer", tagline: "Discounts up to 50%", startsAt: null, endsAt: null };

  it("promoActive: needs enabled + name + tagline + inside the window", () => {
    expect(promoActive(base, "2026-06-15")).toBe(true);
    expect(promoActive({ ...base, enabled: false }, "2026-06-15")).toBe(false);
    expect(promoActive({ ...base, name: "" }, "2026-06-15")).toBe(false);
    expect(promoActive({ ...base, tagline: "" }, "2026-06-15")).toBe(false);
    expect(promoActive({ ...base, startsAt: "2026-06-20" }, "2026-06-15")).toBe(false); // before start
    expect(promoActive({ ...base, endsAt: "2026-06-10" }, "2026-06-15")).toBe(false); // after end
    expect(promoActive({ ...base, startsAt: "2026-06-01", endsAt: "2026-06-30" }, "2026-06-15")).toBe(true);
    expect(promoActive({ ...base, startsAt: "2026-06-15", endsAt: "2026-06-15" }, "2026-06-15")).toBe(true); // inclusive
  });

  it("planDiscount: null = none, 0 = Free, amount = struck; inactive campaign = none", () => {
    expect(planDiscount({ price: 49900, discountedPrice: null }, true).showDiscount).toBe(false);
    expect(planDiscount({ price: 49900, discountedPrice: 24900 }, true)).toMatchObject({ showDiscount: true, discountedPaise: 24900, actualPaise: 49900, isFree: false });
    expect(planDiscount({ price: 49900, discountedPrice: 0 }, true)).toMatchObject({ showDiscount: true, isFree: true });
    expect(planDiscount({ price: 49900, discountedPrice: 24900 }, false).showDiscount).toBe(false); // campaign off
  });

  it("istToday: YYYY-MM-DD in IST", () => {
    expect(istToday(new Date("2026-06-15T20:00:00Z"))).toBe("2026-06-16"); // +5:30 rolls to next day
    expect(istToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── DB-gated ─────────────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("promo persistence (DB)", () => {
  let original: Promo;
  let actorId = "";
  const stamp = Date.now();

  beforeAll(async () => {
    original = await getPromo(); // capture so we can restore the singleton
    const a = await prisma.user.create({ data: { email: `promo-test-${stamp}@example.com`, role: "super_admin" } });
    actorId = a.id;
  });
  afterAll(async () => {
    await savePromoCore(original, actorId); // restore
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("saves + reads back; rejects enabled-without-name and end-before-start", async () => {
    const ok = await savePromoCore({ enabled: true, name: "Test Offer", tagline: "Up to 40%", startsAt: "2026-01-01", endsAt: "2026-12-31" }, actorId);
    expect(ok.ok).toBe(true);
    expect(await getPromo()).toMatchObject({ enabled: true, name: "Test Offer", tagline: "Up to 40%", startsAt: "2026-01-01", endsAt: "2026-12-31" });

    expect((await savePromoCore({ enabled: true, name: "", tagline: "x", startsAt: null, endsAt: null }, actorId)).ok).toBe(false);
    expect((await savePromoCore({ enabled: true, name: "n", tagline: "t", startsAt: "2026-06-30", endsAt: "2026-06-01" }, actorId)).ok).toBe(false);
  });
});
