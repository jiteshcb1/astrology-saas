import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { MockBillingGateway, signPayload } from "../lib/gateway-mock";
import { applyWebhookEvent, runGraceSweep } from "../lib/billing-engine";
import type { GatewayWebhookEvent } from "../lib/gateway";

// ── Pure: signature verification ────────────────────────────────────────────────
describe("mock gateway webhook signature", () => {
  const gw = new MockBillingGateway();
  const secret = "test-webhook-secret";
  const raw = JSON.stringify({ id: "evt_1", type: "subscription.charged", subscriptionRef: "ref" });
  let prev: string | undefined;

  beforeAll(() => {
    prev = process.env.BILLING_WEBHOOK_SECRET;
    process.env.BILLING_WEBHOOK_SECRET = secret;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.BILLING_WEBHOOK_SECRET;
    else process.env.BILLING_WEBHOOK_SECRET = prev;
  });

  it("accepts a correctly signed body", () => {
    const headers = new Headers({ "x-mock-signature": signPayload(raw, secret) });
    expect(gw.verifyWebhook(raw, headers)).toBe(true);
  });

  it("rejects a wrong signature and a tampered body", () => {
    expect(gw.verifyWebhook(raw, new Headers({ "x-mock-signature": "deadbeef" }))).toBe(false);
    const sig = signPayload(raw, secret);
    expect(gw.verifyWebhook(`${raw}x`, new Headers({ "x-mock-signature": sig }))).toBe(false);
  });
});

// ── DB-backed: engine ───────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "billeng-";

d("billing engine (SP-1.6)", () => {
  const stamp = Date.now();
  const REF_A = `${PREFIX}ref-a-${stamp}`;
  const REF_B = `${PREFIX}ref-b-${stamp}`;
  let planId = "";
  let orgA = "";
  let orgB = "";

  const charged = (suffix: string, ref: string, amount = 49900): GatewayWebhookEvent => ({
    id: `${PREFIX}evt-${suffix}-${stamp}`,
    type: "subscription.charged",
    subscriptionRef: ref,
    amount,
    currency: "INR",
  });

  beforeAll(async () => {
    const plan = await prisma.subscriptionPlan.create({
      data: { name: `${PREFIX}plan`, price: 49900, includedSeats: 1, perSeatPrice: 0 },
    });
    planId = plan.id;
    const a = await prisma.organization.create({ data: { name: "Bill A", slug: `${PREFIX}a-${stamp}` } });
    const b = await prisma.organization.create({ data: { name: "Bill B", slug: `${PREFIX}b-${stamp}` } });
    orgA = a.id;
    orgB = b.id;
    await prisma.subscription.create({ data: { orgId: orgA, planId, seatCount: 1, status: "active", gatewaySubscriptionRef: REF_A } });
    await prisma.subscription.create({ data: { orgId: orgB, planId, seatCount: 1, status: "active", gatewaySubscriptionRef: REF_B } });
  });

  afterAll(async () => {
    await prisma.billingEvent.deleteMany({ where: { gatewayEventId: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { orgId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades subs + receipts
    await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
    await prisma.$disconnect();
  });

  it("applies a charge: active + period end + one receipt + audit", async () => {
    const res = await applyWebhookEvent(charged("c1", REF_A));
    expect(res.ok).toBe(true);
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionRef: REF_A } });
    expect(sub?.status).toBe("active");
    expect(sub?.currentPeriodEnd).toBeTruthy();
    const receipts = await prisma.receipt.findMany({ where: { organizationId: orgA, type: "subscription" } });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].amount).toBe(49900);
    expect(Number.isInteger(receipts[0].amount)).toBe(true);
    expect(await prisma.auditLog.count({ where: { orgId: orgA, action: "subscription.charged" } })).toBeGreaterThan(0);
  });

  it("is idempotent: replaying the same event id does nothing", async () => {
    const replay = await applyWebhookEvent(charged("c1", REF_A)); // same id as above
    expect(replay.duplicate).toBe(true);
    expect(await prisma.receipt.count({ where: { organizationId: orgA, type: "subscription" } })).toBe(1);
    expect(await prisma.billingEvent.count({ where: { gatewayEventId: `${PREFIX}evt-c1-${stamp}` } })).toBe(1);
  });

  it("marks past_due on payment failure", async () => {
    await applyWebhookEvent({
      id: `${PREFIX}evt-fail-${stamp}`,
      type: "subscription.payment_failed",
      subscriptionRef: REF_A,
    });
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionRef: REF_A } });
    expect(sub?.status).toBe("past_due");
    expect(sub?.pastDueSince).toBeTruthy();
  });

  it("grace sweep suspends the org via organizations.status", async () => {
    // Backdate the grace clock past the window.
    await prisma.subscription.updateMany({
      where: { gatewaySubscriptionRef: REF_A },
      data: { pastDueSince: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const { suspended } = await runGraceSweep();
    expect(suspended).toBeGreaterThanOrEqual(1);
    const org = await prisma.organization.findUnique({ where: { id: orgA } });
    expect(org?.status).toBe("suspended");
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionRef: REF_A } });
    expect(sub?.suspendedForNonpayment).toBe(true);
    expect(await prisma.auditLog.count({ where: { orgId: orgA, action: "org.suspend" } })).toBeGreaterThan(0);
  });

  it("recovery: a charge reactivates a billing-suspended org", async () => {
    await applyWebhookEvent(charged("c2", REF_A));
    const org = await prisma.organization.findUnique({ where: { id: orgA } });
    expect(org?.status).toBe("active");
    const sub = await prisma.subscription.findFirst({ where: { gatewaySubscriptionRef: REF_A } });
    expect(sub?.status).toBe("active");
    expect(sub?.suspendedForNonpayment).toBe(false);
  });

  it("does NOT reactivate a manually suspended org on charge", async () => {
    await prisma.organization.update({ where: { id: orgB }, data: { status: "suspended" } });
    await applyWebhookEvent(charged("c3", REF_B));
    const org = await prisma.organization.findUnique({ where: { id: orgB } });
    expect(org?.status).toBe("suspended"); // flag was false → not auto-reactivated
  });

  it("ignores events for an unknown subscription", async () => {
    const res = await applyWebhookEvent(charged("c4", `${PREFIX}nonexistent`));
    expect(res.ignored).toBe(true);
  });
});
