import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { deletePlanCore } from "../lib/billing";
import { deleteConsultantCore } from "../lib/consultants";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "delguard-";

d("delete guards (SP-1.8)", () => {
  const stamp = Date.now();
  let actorId = "";
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.featureFlag.deleteMany({ where: { scopeId: { in: createdPlanIds } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades subs + receipts
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: createdPlanIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("blocks deleting a plan with an active subscription; allows once reassigned", async () => {
    const plan = await prisma.subscriptionPlan.create({
      data: { name: `${PREFIX}p1`, price: 1000, includedSeats: 1, perSeatPrice: 0 },
    });
    createdPlanIds.push(plan.id);
    const org = await prisma.organization.create({ data: { name: "O", slug: `${PREFIX}o1-${stamp}` } });
    const sub = await prisma.subscription.create({
      data: { orgId: org.id, planId: plan.id, seatCount: 1, status: "active" },
    });

    expect((await deletePlanCore(plan.id, actorId)).ok).toBe(false);

    await prisma.subscription.delete({ where: { id: sub.id } });
    expect((await deletePlanCore(plan.id, actorId)).ok).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { actorUserId: actorId, action: "plan.delete" } }),
    ).toBeGreaterThan(0);
  });

  it("blocks deleting a plan referenced by a plan-scoped feature flag", async () => {
    const plan = await prisma.subscriptionPlan.create({
      data: { name: `${PREFIX}p2`, price: 1000, includedSeats: 1, perSeatPrice: 0 },
    });
    createdPlanIds.push(plan.id);
    await prisma.featureFlag.create({
      data: { key: `${PREFIX}flag`, scope: "plan", scopeId: plan.id, enabled: true },
    });
    expect((await deletePlanCore(plan.id, actorId)).ok).toBe(false);
  });

  it("blocks deleting a consultant with receipts; allows without", async () => {
    const orgWith = await prisma.organization.create({ data: { name: "W", slug: `${PREFIX}with-${stamp}` } });
    await prisma.receipt.create({
      data: { organizationId: orgWith.id, type: "subscription", issuedTo: "x", amount: 100, currency: "INR" },
    });
    expect((await deleteConsultantCore(orgWith.id, actorId)).ok).toBe(false);

    const orgWithout = await prisma.organization.create({ data: { name: "N", slug: `${PREFIX}without-${stamp}` } });
    expect((await deleteConsultantCore(orgWithout.id, actorId)).ok).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { actorUserId: actorId, action: "org.delete" } }),
    ).toBeGreaterThan(0);
  });
});
