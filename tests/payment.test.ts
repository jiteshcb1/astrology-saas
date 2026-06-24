import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../lib/db";
import { reserveSlot } from "../lib/scheduling";
import { saveGatewayCore } from "../lib/payments";
import {
  validateProofFile,
  confirmGatewayPaymentCore,
  submitUpiProofCore,
  applyPaymentWebhookEvent,
  verifyBookingPaymentCore,
} from "../lib/payment";
import { verifyCheckoutSignature, verifyWebhookSignature, type RazorpayWebhookEvent } from "../lib/razorpay";

// Encryption must be configured for the gateway paths (decrypt key_secret to verify signatures).
process.env.ENCRYPTION_MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || "test-master-key-please-rotate-in-prod";

const KEY_ID = "rzp_test_key";
const KEY_SECRET = "rzp_test_secret_123";
function checkoutSig(orderId: string, paymentId: string): string {
  return createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}

// ── Pure (always run) ────────────────────────────────────────────────────────
describe("payment validators (pure)", () => {
  it("validates proof file type + size", () => {
    expect(validateProofFile("image/png", 1000).ok).toBe(true);
    expect(validateProofFile("application/pdf", 1000).ok).toBe(true);
    expect(validateProofFile("text/plain", 1000).ok).toBe(false);
    expect(validateProofFile("image/png", 6 * 1024 * 1024).ok).toBe(false);
    expect(validateProofFile("image/png", 0).ok).toBe(false);
  });

  it("verifies checkout + webhook HMAC signatures", () => {
    expect(verifyCheckoutSignature(KEY_SECRET, "order_1", "pay_1", checkoutSig("order_1", "pay_1"))).toBe(true);
    expect(verifyCheckoutSignature(KEY_SECRET, "order_1", "pay_1", "deadbeef")).toBe(false);
    const raw = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", "whsec").update(raw).digest("hex");
    expect(verifyWebhookSignature(raw, sig, "whsec")).toBe(true);
    expect(verifyWebhookSignature(raw, "bad", "whsec")).toBe(false);
  });
});

// ── DB-gated ─────────────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "payf-"; // distinct from payments.test.ts ("pay-") to avoid cross-suite cleanup collision
const T0 = new Date("2026-07-01T08:00:00Z");
const MID = new Date("2026-07-01T08:05:00Z"); // within the 10-min hold
const LATE = new Date("2026-07-01T08:30:00Z"); // after hold expiry

d("payment flow", () => {
  const stamp = Date.now();
  let orgId = "";
  let pkgId = "";
  let nth = 0;

  async function freshHold(): Promise<string> {
    // Retry rides out transient null reads from remote Neon under full-suite concurrent load
    // (documented flakiness; passes cleanly in isolation). Each retry uses a fresh, non-overlapping slot.
    let lastReason = "";
    for (let attempt = 0; attempt < 4; attempt++) {
      const start = new Date(`2026-07-${String(2 + nth++).padStart(2, "0")}T09:00:00Z`); // unique day per booking
      const r = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "h", startsAt: start, durationMin: 30, now: T0 });
      if (r.ok) return r.bookingId;
      lastReason = r.reason;
    }
    throw new Error("reserve failed: " + lastReason);
  }

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${PREFIX}o-${stamp}@e.com`, role: "consultant" } });
    const org = await prisma.organization.create({ data: { name: "Pay Org", slug: `${PREFIX}org-${stamp}`, ownerUserId: user.id } });
    orgId = org.id;
    await prisma.consultantProfile.create({ data: { organizationId: orgId, displayName: "Pandit", gstNumber: "27AAAAA0000A1Z5", onboardedAt: new Date() } });
    const pkg = await prisma.package.create({ data: { organizationId: orgId, title: "Reading", slug: "reading", allowedDurations: [30], defaultDurationMin: 30, price: 150000, slotIntervalMin: 30 } });
    pkgId = pkg.id;
    await saveGatewayCore(orgId, { keyId: KEY_ID, keySecret: KEY_SECRET }, user.id);
  });

  afterAll(async () => {
    await prisma.paymentEvent.deleteMany({ where: { gatewayEventId: { startsWith: PREFIX } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { orgId } });
    await prisma.$disconnect();
  });

  it("gateway: valid signature confirms the booking + writes a receipt", async () => {
    const bookingId = await freshHold();
    const orderId = "order_g1", paymentId = "pay_g1";
    const res = await confirmGatewayPaymentCore(orgId, bookingId, { orderId, paymentId, signature: checkoutSig(orderId, paymentId) }, MID);
    expect(res.ok).toBe(true);
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(b?.status).toBe("confirmed");
    const pay = await prisma.payment.findFirst({ where: { bookingId } });
    expect(pay?.status).toBe("success");
    expect(pay?.gatewayPaymentRef).toBe(paymentId);
    expect(await prisma.receipt.count({ where: { bookingId, type: "consultation" } })).toBe(1);
  });

  it("gateway: bad signature is refused, booking untouched", async () => {
    const bookingId = await freshHold();
    const res = await confirmGatewayPaymentCore(orgId, bookingId, { orderId: "o", paymentId: "p", signature: "bad" }, MID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("signature");
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(b?.status).toBe("held");
  });

  it("hold expired during payment: confirm fails safely, no silent loss", async () => {
    const bookingId = await freshHold();
    const orderId = "order_x", paymentId = "pay_x";
    const res = await confirmGatewayPaymentCore(orgId, bookingId, { orderId, paymentId, signature: checkoutSig(orderId, paymentId) }, LATE);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(b?.status).not.toBe("confirmed");
    const pay = await prisma.payment.findFirst({ where: { bookingId } });
    expect(pay?.status).toBe("success"); // flagged for refund, not dropped
  });

  it("webhook: replayed payment.captured is idempotent (one confirm, one receipt)", async () => {
    const bookingId = await freshHold();
    const orderId = `order_wh_${stamp}`;
    await prisma.payment.create({ data: { organizationId: orgId, bookingId, mode: "gateway", amount: 150000, status: "initiated", gatewayOrderId: orderId } });
    const event: RazorpayWebhookEvent = { id: `${PREFIX}evt-${stamp}`, type: "payment.captured", orderId, paymentId: "pay_wh", amount: 150000 };

    const first = await applyPaymentWebhookEvent(orgId, event, MID);
    const second = await applyPaymentWebhookEvent(orgId, event, MID);
    expect(first.ok).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(await prisma.receipt.count({ where: { bookingId, type: "consultation" } })).toBe(1);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("confirmed");
  });

  it("UPI: submit proof → pending_verification; consultant confirm → confirmed + receipt", async () => {
    const bookingId = await freshHold();
    const submit = await submitUpiProofCore(orgId, bookingId, { proofImageKey: `payments/${orgId}/proofs/${bookingId}.png`, utrReference: "123456789012" }, MID);
    expect(submit.ok).toBe(true);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("pending_verification");

    const verify = await verifyBookingPaymentCore(orgId, bookingId, "confirm", "actor-1");
    expect(verify.ok).toBe(true);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("confirmed");
    expect(await prisma.receipt.count({ where: { bookingId } })).toBe(1);
  });

  it("UPI: consultant reject → cancelled + slot released", async () => {
    const bookingId = await freshHold();
    await submitUpiProofCore(orgId, bookingId, { proofImageKey: `payments/${orgId}/proofs/${bookingId}.png` }, MID);
    const res = await verifyBookingPaymentCore(orgId, bookingId, "reject", "actor-1");
    expect(res.ok).toBe(true);
    expect((await prisma.booking.findUnique({ where: { id: bookingId } }))?.status).toBe("cancelled");
    const slot = await prisma.bookingSlot.findFirst({ where: { bookingId } });
    expect(slot?.active).toBe(false);
  });
});
