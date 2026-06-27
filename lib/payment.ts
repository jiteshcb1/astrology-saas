import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantDb, tenantTransaction, type Scoped } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { getActiveOrgBySlug } from "@/lib/public-page";
import { getPaymentMethod, toSafeView, type SafePaymentView } from "@/lib/payments";
import { decryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { createOrder, verifyCheckoutSignature, type RazorpayWebhookEvent } from "@/lib/razorpay";
import { getSignedUrl } from "@/lib/storage";
import { invalidateMemberBusyCache } from "@/lib/calendar-freebusy";
import { ensureMeetLink } from "@/lib/calendar-events";
import { formatMoney } from "@/lib/money";
import {
  notifyBookingConfirmed,
  notifyProofReceived,
  notifyBookingDeclined,
  notifyNewBooking,
} from "@/lib/notifications";

// Payment cores (SP-4.3). Platform NEVER touches funds: gateway orders are created on the consultant's
// OWN Razorpay keys (funds settle to them); UPI is their own VPA. Secrets are decrypted (lib/crypto.ts)
// ONLY here, server-side, at charge time — never to the client, never logged. The hold→confirmed/
// pending_verification transition is a conditional CAS, mutually exclusive with the SP-4.2 expiry sweep.

const HOLD_OPEN = ["held", "pending_payment"]; // states a fresh payment may transition FROM
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// The generic tenant facade doesn't narrow `include`, so type these payloads explicitly.
type BkPkg = Prisma.BookingGetPayload<{ include: { package: true } }>;
type BkPkgPay = Prisma.BookingGetPayload<{ include: { package: true; payment: true } }>;
type BkPkgSlot = Prisma.BookingGetPayload<{ include: { package: true; slot: true } }>;

// ── Pure: proof file validation (also used client-side) ──────────────────────
export function validateProofFile(type: string, size: number): { ok: boolean; error?: string } {
  if (!PROOF_TYPES.includes(type)) return { ok: false, error: "Upload an image (PNG/JPG/WebP) or PDF." };
  if (size > MAX_PROOF_BYTES) return { ok: false, error: "File is too large — max 5 MB." };
  if (size <= 0) return { ok: false, error: "That file looks empty." };
  return { ok: true };
}

// ── Payment context for the seeker payment step ──────────────────────────────
export interface PaymentContext {
  orgId: string;
  status: string;
  amountPaise: number;
  priceLabel: string;
  consultantName: string;
  paymentView: SafePaymentView | null;
  payment: { status: string; utrReference: string | null } | null;
}

export async function getPaymentContext(slug: string, bookingId: string): Promise<PaymentContext | null> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return null;
  const booking = (await tenantDb(org.orgId).booking.findFirst({
    where: { id: bookingId },
    include: { package: true, payment: true },
  })) as BkPkgPay | null;
  if (!booking || !booking.package) return null;
  const safe = await toSafeView(await getPaymentMethod(org.orgId));
  return {
    orgId: org.orgId,
    status: booking.status,
    amountPaise: booking.package.price,
    priceLabel: formatMoney(booking.package.price),
    consultantName: org.profile.displayName,
    paymentView: safe,
    payment: booking.payment ? { status: booking.payment.status, utrReference: booking.payment.utrReference } : null,
  };
}

// ── Receipt helper (consultation → consultant's GST). PDF rendered + stored before the tx. ──
async function buildConsultationReceipt(
  orgId: string,
  booking: { id: string; durationMin: number; seekerName: string | null; package: { title: string; price: number }; slot: { startsAt: Date } | null },
): Promise<{ amount: number; currency: string; gstNumber: string; pdfUrl: string; receiptNumber: string }> {
  // SP-4.4: the receipt is a branded HTML page (Workers-safe, no PDF). We keep the Receipt record and
  // store the receipt's web path in pdfUrl so dashboards/oversight can link to it.
  const [profile, org] = await Promise.all([
    tenantDb(orgId).consultantProfile.findFirst(),
    prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } }),
  ]);
  const gstNumber = profile?.gstNumber ?? "";
  const receiptNumber = `CON-${booking.id.slice(-10)}`;
  const pdfUrl = org ? `/${org.slug}/book/${booking.id}/receipt` : "";
  return { amount: booking.package.price, currency: "INR", gstNumber, pdfUrl, receiptNumber };
}

async function writeReceiptRow(
  t: Scoped,
  orgId: string,
  bookingId: string,
  issuedTo: string,
  r: { amount: number; currency: string; gstNumber: string; pdfUrl: string },
) {
  await t.receipt.create({
    data: {
      type: "consultation",
      bookingId,
      issuedTo,
      gstNumberUsed: r.gstNumber || null,
      amount: r.amount,
      currency: r.currency,
      pdfUrl: r.pdfUrl,
    },
  });
}

// ── Gateway: create the order on the consultant's keys ───────────────────────
export type CreateOrderCoreResult =
  | { ok: true; orderId: string; keyId: string; amount: number; currency: string; consultantName: string }
  | { ok: false; error: string };

export async function createGatewayOrderCore(orgId: string, bookingId: string): Promise<CreateOrderCoreResult> {
  const booking = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true } })) as BkPkg | null;
  if (!booking || !booking.package) return { ok: false, error: "Booking not found." };
  if (!HOLD_OPEN.includes(booking.status)) return { ok: false, error: "This booking can no longer be paid." };

  const pm = await getPaymentMethod(orgId);
  if (!pm || pm.mode !== "gateway" || !pm.gatewayKeyIdEnc || !pm.gatewayKeySecretEnc) {
    return { ok: false, error: "This consultant hasn't set up card/gateway payments." };
  }
  if (!isEncryptionConfigured()) return { ok: false, error: "Payments are not configured. Please contact the consultant." };

  // Decrypt ONLY here, at charge time.
  const keyId = decryptSecret(pm.gatewayKeyIdEnc);
  const keySecret = decryptSecret(pm.gatewayKeySecretEnc);
  const amount = booking.package.price;

  const order = await createOrder(keyId, keySecret, {
    amount,
    currency: "INR",
    receipt: bookingId.slice(-40),
    notes: { orgId, bookingId },
  });
  if (!order.ok) return { ok: false, error: order.message };

  // Upsert the payment row (initiated). bookingId is unique → update-or-create.
  await tenantTransaction(async ({ tenant }) => {
    const t = tenant(orgId);
    const upd = await t.payment.updateMany({
      where: { bookingId },
      data: { mode: "gateway", amount, status: "initiated", gatewayOrderId: order.orderId },
    });
    if (upd.count === 0) {
      await t.payment.create({ data: { bookingId, mode: "gateway", amount, status: "initiated", gatewayOrderId: order.orderId } });
    }
  });

  const profile = await tenantDb(orgId).consultantProfile.findFirst();
  return { ok: true, orderId: order.orderId, keyId, amount, currency: "INR", consultantName: profile?.displayName ?? "Consultant" };
}

// ── The shared confirm transition (gateway callback + webhook) ───────────────
export type ConfirmPayResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; reason: "signature" | "expired" | "not_found" };

type PaymentRefPatch = { gatewayPaymentRef?: string; gatewayOrderId?: string };

// Fused CAS inside a caller-provided tx: HOLD_OPEN + unexpired → confirmed (+ payment success + receipt
// + audit). Mutually exclusive with the expiry sweep (sweep only touches HOLD_OPEN & expired → disjoint).
async function confirmBookingInTx(
  t: Scoped,
  db: Pick<Prisma.TransactionClient, "auditLog">,
  orgId: string,
  bookingId: string,
  packagePrice: number,
  receipt: { amount: number; currency: string; gstNumber: string; pdfUrl: string; receiptNumber: string },
  patch: PaymentRefPatch,
  source: string,
  now: Date,
): Promise<{ ok: boolean; expired?: boolean; changed?: boolean }> {
  const upsertPayment = async (status: string) => {
    const upd = await t.payment.updateMany({ where: { bookingId }, data: { ...patch, status } });
    if (upd.count === 0) await t.payment.create({ data: { bookingId, mode: "gateway", amount: packagePrice, status, ...patch } });
  };

  const res = await t.booking.updateMany({
    where: { id: bookingId, status: { in: HOLD_OPEN }, holdExpiresAt: { gt: now } },
    data: { status: "confirmed" },
  });
  if (res.count !== 1) {
    const cur = await t.booking.findFirst({ where: { id: bookingId }, select: { status: true } });
    if (cur?.status === "confirmed") return { ok: true, changed: false }; // the other path already confirmed — idempotent
    // Lost the race to the sweep (expired). Money may have been captured — flag, never drop silently.
    await upsertPayment("success");
    await writeAuditLog({ actorUserId: null, action: "payment.orphaned_after_expiry", resourceType: "booking", resourceId: bookingId, orgId, metadata: { source } }, db);
    return { ok: false, expired: true };
  }
  await upsertPayment("success");
  await writeReceiptRow(t, orgId, bookingId, receipt.receiptNumber, receipt);
  await writeAuditLog({ actorUserId: null, action: "booking.confirmed", resourceType: "booking", resourceId: bookingId, orgId, metadata: { source, amount: receipt.amount, currency: receipt.currency } }, db);
  return { ok: true, changed: true };
}

// Runs the confirm in a tx and returns whether THIS call did the transition (for one-shot notifications).
async function transitionToConfirmed(
  orgId: string,
  bookingId: string,
  patch: PaymentRefPatch,
  source: string,
  now: Date,
): Promise<ConfirmPayResult & { changed?: boolean }> {
  const booking = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true, slot: true } })) as BkPkgSlot | null;
  if (!booking || !booking.package) return { ok: false, reason: "not_found" };
  if (booking.status === "confirmed") return { ok: true, duplicate: true, changed: false };
  const receipt = await buildConsultationReceipt(orgId, booking);
  const r = await tenantTransaction(async ({ db, tenant }) =>
    confirmBookingInTx(tenant(orgId), db, orgId, bookingId, booking.package.price, receipt, patch, source, now),
  );
  return r.ok ? { ok: true, changed: r.changed } : { ok: false, reason: "expired" };
}

export async function confirmGatewayPaymentCore(
  orgId: string,
  bookingId: string,
  proof: { orderId: string; paymentId: string; signature: string },
  now: Date = new Date(),
): Promise<ConfirmPayResult> {
  const pm = await getPaymentMethod(orgId);
  if (!pm || !pm.gatewayKeySecretEnc || !isEncryptionConfigured()) return { ok: false, reason: "not_found" };
  const keySecret = decryptSecret(pm.gatewayKeySecretEnc);
  if (!verifyCheckoutSignature(keySecret, proof.orderId, proof.paymentId, proof.signature)) {
    return { ok: false, reason: "signature" };
  }
  const res = await transitionToConfirmed(orgId, bookingId, { gatewayPaymentRef: proof.paymentId, gatewayOrderId: proof.orderId }, "gateway_callback", now);
  if (res.changed) {
    await ensureMeetLink(orgId, bookingId); // T-1.3: best-effort Google event + Meet link, before the email
    await notifyBookingConfirmed(orgId, bookingId);
    await notifyNewBooking(orgId, bookingId, "gateway");
  }
  return res.ok ? { ok: true } : { ok: false, reason: res.reason ?? "expired" };
}

// ── UPI: seeker submits proof → pending_verification (consultant confirms later) ──
export type ProofResult = { ok: true } | { ok: false; reason: "expired" | "not_found" };

export async function submitUpiProofCore(
  orgId: string,
  bookingId: string,
  input: { proofImageKey: string; utrReference?: string },
  now: Date = new Date(),
): Promise<ProofResult> {
  const booking = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true } })) as BkPkg | null;
  if (!booking || !booking.package) return { ok: false, reason: "not_found" };
  const amount = booking.package.price;

  const result = await tenantTransaction(async ({ db, tenant }) => {
    const t = tenant(orgId);
    const res = await t.booking.updateMany({
      where: { id: bookingId, status: { in: HOLD_OPEN }, holdExpiresAt: { gt: now } },
      data: { status: "pending_verification" },
    });
    const patch = {
      mode: "upi_qr",
      amount,
      status: "pending_verification",
      proofImageKey: input.proofImageKey,
      utrReference: input.utrReference ?? null,
    };
    const upd = await t.payment.updateMany({ where: { bookingId }, data: patch });
    if (upd.count === 0) await t.payment.create({ data: { bookingId, ...patch } });

    if (res.count !== 1) {
      // Hold lapsed — record the proof anyway (so the consultant can refund/credit), but don't confirm.
      await writeAuditLog(
        { actorUserId: null, action: "payment.proof_after_expiry", resourceType: "booking", resourceId: bookingId, orgId },
        db,
      );
      return { ok: false, reason: "expired" as const };
    }
    await writeAuditLog(
      { actorUserId: null, action: "booking.proof_submitted", resourceType: "booking", resourceId: bookingId, orgId },
      db,
    );
    return { ok: true as const };
  });

  if (result.ok) {
    await notifyProofReceived(orgId, bookingId);
    await notifyNewBooking(orgId, bookingId, "upi_qr");
  }
  return result;
}

// ── Webhook (idempotent, mirrors SP-1.6) ─────────────────────────────────────
export async function applyPaymentWebhookEvent(
  orgId: string,
  event: RazorpayWebhookEvent,
  now: Date = new Date(),
): Promise<{ ok: boolean; duplicate?: boolean; ignored?: boolean }> {
  if (event.type !== "payment.captured" && event.type !== "order.paid") return { ok: true, ignored: true };
  if (!event.orderId) return { ok: true, ignored: true };

  const payment = await tenantDb(orgId).payment.findFirst({ where: { gatewayOrderId: event.orderId } });
  if (!payment) return { ok: true, ignored: true };
  const booking = (await tenantDb(orgId).booking.findFirst({ where: { id: payment.bookingId }, include: { package: true, slot: true } })) as BkPkgSlot | null;
  if (!booking || !booking.package) return { ok: true, ignored: true };
  const receipt = await buildConsultationReceipt(orgId, booking); // deterministic key; harmless if duplicate

  // Dedup + confirm in ONE transaction: a replay collides on gatewayEventId @unique → P2002 → the
  // whole thing rolls back (no double confirm/receipt).
  try {
    const res = await tenantTransaction(async ({ db, tenant }) => {
      await db.paymentEvent.create({ data: { gatewayEventId: event.id, type: event.type, payload: { id: event.id, type: event.type, orderId: event.orderId } as Prisma.InputJsonValue } });
      return confirmBookingInTx(
        tenant(orgId),
        db,
        orgId,
        payment.bookingId,
        booking.package.price,
        receipt,
        { gatewayPaymentRef: event.paymentId ?? undefined, gatewayOrderId: event.orderId ?? undefined },
        "gateway_webhook",
        now,
      );
    });
    if (res.changed) {
      await ensureMeetLink(orgId, payment.bookingId); // T-1.3
      await notifyBookingConfirmed(orgId, payment.bookingId);
      await notifyNewBooking(orgId, payment.bookingId, "gateway");
    }
    return { ok: res.ok || res.expired === true };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, duplicate: true };
    throw e;
  }
}

// ── Consultant verification (UPI proofs) ─────────────────────────────────────
export type VerifyResult = { ok: true } | { ok: false; error: string };

export async function verifyBookingPaymentCore(
  orgId: string,
  bookingId: string,
  decision: "confirm" | "reject",
  actorUserId: string,
): Promise<VerifyResult> {
  const booking = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true, slot: true } })) as BkPkgSlot | null;
  if (!booking || !booking.package) return { ok: false, error: "Booking not found." };
  if (booking.status !== "pending_verification") return { ok: false, error: "This booking is not awaiting verification." };

  if (decision === "confirm") {
    const receipt = await buildConsultationReceipt(orgId, booking);
    const result = await tenantTransaction(async ({ db, tenant }) => {
      const t = tenant(orgId);
      const res = await t.booking.updateMany({ where: { id: bookingId, status: "pending_verification" }, data: { status: "confirmed" } });
      if (res.count !== 1) return { ok: false as const, error: "This booking changed — refresh and try again." };
      await t.payment.updateMany({ where: { bookingId }, data: { status: "success", verifiedByUserId: actorUserId } });
      await writeReceiptRow(t, orgId, bookingId, receipt.receiptNumber, receipt);
      await writeAuditLog(
        { actorUserId, action: "booking.confirmed", resourceType: "booking", resourceId: bookingId, orgId, metadata: { source: "manual_verify", amount: receipt.amount } },
        db,
      );
      return { ok: true as const };
    });
    if (result.ok) {
      await ensureMeetLink(orgId, bookingId); // T-1.3
      await notifyBookingConfirmed(orgId, bookingId);
    }
    return result;
  }

  // reject → cancelled + release the slot
  const result = await tenantTransaction(async ({ db, tenant }) => {
    const t = tenant(orgId);
    const res = await t.booking.updateMany({ where: { id: bookingId, status: "pending_verification" }, data: { status: "cancelled" } });
    if (res.count !== 1) return { ok: false as const, error: "This booking changed — refresh and try again." };
    await t.bookingSlot.updateMany({ where: { bookingId }, data: { active: false } });
    await t.payment.updateMany({ where: { bookingId }, data: { status: "failed", verifiedByUserId: actorUserId } });
    await writeAuditLog(
      { actorUserId, action: "booking.rejected", resourceType: "booking", resourceId: bookingId, orgId },
      db,
    );
    return { ok: true as const };
  });
  if (result.ok) {
    // T-1.2: the host's slot freed up → drop their cached free/busy so the next slot load is fresh.
    if (booking.slot?.hostMemberId) invalidateMemberBusyCache(booking.slot.hostMemberId);
    await notifyBookingDeclined(orgId, bookingId);
  }
  return result;
}

// ── Consultant booking list + proof viewing ──────────────────────────────────
export type ConsultantBooking = Prisma.BookingGetPayload<{ include: { package: true; slot: true; payment: true } }>;

export async function listConsultantBookings(orgId: string): Promise<ConsultantBooking[]> {
  return (await tenantDb(orgId).booking.findMany({
    where: { status: { in: ["pending_verification", "confirmed", "pending_payment", "cancelled"] } },
    include: { package: true, slot: true, payment: true },
    orderBy: { createdAt: "desc" },
  })) as ConsultantBooking[];
}

export async function getProofUrl(orgId: string, bookingId: string): Promise<string | null> {
  const payment = await tenantDb(orgId).payment.findFirst({ where: { bookingId } });
  if (!payment?.proofImageKey) return null;
  return getSignedUrl(payment.proofImageKey);
}
