import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  assignPlanCore,
  createPlanCore,
  type PlanInput,
  setPlanActiveCore,
  updatePlanCore,
} from "../lib/billing";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "plan-test-";

const basePlanInput = (over: Partial<PlanInput> = {}): PlanInput => ({
  name: `${PREFIX}plan`,
  price: 49900,
  currency: "inr",
  billingInterval: "monthly",
  includedSeats: 1,
  perSeatPrice: 19900,
  features: { teams: true },
  discountedPrice: null,
  ...over,
});

d("Plans + subscriptions (SP-1.4)", () => {
  let actorId = "";
  const stamp = Date.now();
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    // Orgs cascade-delete their subscriptions, freeing the plan FK before we delete plans.
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: createdPlanIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("creates a plan with integer paise + uppercased currency + audit", async () => {
    const result = await createPlanCore(basePlanInput(), actorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdPlanIds.push(result.planId);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: result.planId } });
    expect(plan?.price).toBe(49900);
    expect(Number.isInteger(plan?.price)).toBe(true);
    expect(plan?.perSeatPrice).toBe(19900);
    expect(plan?.currency).toBe("INR");
    expect(plan?.includedSeats).toBe(1);
    expect(plan?.features).toEqual({ teams: true });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "plan.create", resourceId: result.planId },
    });
    expect(audit?.actorUserId).toBe(actorId);
  });

  it("rejects invalid input (negative price)", async () => {
    const result = await createPlanCore(basePlanInput({ price: -1 }), actorId);
    expect(result.ok).toBe(false);
  });

  it("accepts a valid discountedPrice (and Free), rejects a discount above the base price", async () => {
    const ok = await createPlanCore(basePlanInput({ name: `${PREFIX}disc`, price: 49900, discountedPrice: 24900 }), actorId);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      createdPlanIds.push(ok.planId);
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: ok.planId } });
      expect(plan?.discountedPrice).toBe(24900);
    }
    const free = await createPlanCore(basePlanInput({ name: `${PREFIX}free`, price: 49900, discountedPrice: 0 }), actorId);
    expect(free.ok).toBe(true);
    if (free.ok) createdPlanIds.push(free.planId);

    const bad = await createPlanCore(basePlanInput({ name: `${PREFIX}bad`, price: 49900, discountedPrice: 60000 }), actorId);
    expect(bad.ok).toBe(false);
  });

  it("updates a plan and writes an audit entry", async () => {
    const created = await createPlanCore(basePlanInput({ name: `${PREFIX}edit` }), actorId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdPlanIds.push(created.planId);

    const result = await updatePlanCore(
      created.planId,
      basePlanInput({ name: `${PREFIX}edited`, price: 59900 }),
      actorId,
    );
    expect(result.ok).toBe(true);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: created.planId } });
    expect(plan?.name).toBe(`${PREFIX}edited`);
    expect(plan?.price).toBe(59900);
    expect(
      await prisma.auditLog.count({ where: { action: "plan.update", resourceId: created.planId } }),
    ).toBeGreaterThan(0);
  });

  it("assigns a plan to an org with seat count + audit; reassign upserts; inactive/unknown rejected", async () => {
    const created = await createPlanCore(basePlanInput({ name: `${PREFIX}assign` }), actorId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    createdPlanIds.push(created.planId);

    const org = await prisma.organization.create({
      data: { name: "Plan Test Org", slug: `${PREFIX}org-${stamp}` },
    });

    // Unknown plan rejected.
    expect((await assignPlanCore(org.id, "nonexistent", 1, actorId)).ok).toBe(false);

    // Assign with 3 seats → one subscription, status active, seatCount 3.
    expect((await assignPlanCore(org.id, created.planId, 3, actorId)).ok).toBe(true);
    let sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.planId).toBe(created.planId);
    expect(sub?.seatCount).toBe(3);
    expect(sub?.status).toBe("active");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "subscription.assign", orgId: org.id },
    });
    // metadata effectivePrice = 49900 + 2*19900 = 89700
    expect((audit?.metadata as { effectivePrice?: number })?.effectivePrice).toBe(89700);

    // Reassign updates the same row (upsert), not a second subscription.
    expect((await assignPlanCore(org.id, created.planId, 5, actorId)).ok).toBe(true);
    sub = await prisma.subscription.findUnique({ where: { orgId: org.id } });
    expect(sub?.seatCount).toBe(5);
    expect(await prisma.subscription.count({ where: { orgId: org.id } })).toBe(1);

    // Inactive plan cannot be assigned.
    await setPlanActiveCore(created.planId, false, actorId);
    expect((await assignPlanCore(org.id, created.planId, 1, actorId)).ok).toBe(false);
  });
});
