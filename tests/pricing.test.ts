import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { listPublicPlans } from "../lib/billing";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "pubplan-";

d("public pricing — listPublicPlans (SP-6.1)", () => {
  const stamp = Date.now();

  beforeAll(async () => {
    await prisma.subscriptionPlan.createMany({
      data: [
        { name: `${PREFIX}mid-${stamp}`, price: 49900, includedSeats: 1, perSeatPrice: 19900, billingInterval: "monthly", isActive: true },
        { name: `${PREFIX}low-${stamp}`, price: 0, includedSeats: 1, perSeatPrice: 0, billingInterval: "monthly", isActive: true },
        { name: `${PREFIX}hidden-${stamp}`, price: 99900, includedSeats: 3, perSeatPrice: 0, billingInterval: "monthly", isActive: false },
      ],
    });
  });

  afterAll(async () => {
    await prisma.subscriptionPlan.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns only active plans, cheapest first (excludes inactive)", async () => {
    const mine = (await listPublicPlans()).filter((p) => p.name.startsWith(PREFIX));
    expect(mine.map((p) => p.name)).toEqual([`${PREFIX}low-${stamp}`, `${PREFIX}mid-${stamp}`]); // price asc; inactive excluded
    expect(mine.every((p) => p.isActive)).toBe(true);
  });
});
