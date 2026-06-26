"use server";

import { getActiveOrgBySlug } from "@/lib/public-page";
import { assignAndReserveSlot } from "@/lib/scheduling";
import { confirmBookingDetailsCore, type ConfirmResult, type SeekerDetails } from "@/lib/booking";
import {
  createGatewayOrderCore,
  confirmGatewayPaymentCore,
  submitUpiProofCore,
  validateProofFile,
  type CreateOrderCoreResult,
  type ConfirmPayResult,
  type ProofResult,
} from "@/lib/payment";
import { putObject } from "@/lib/storage";

// All public (unauthenticated). Each action re-resolves the ACTIVE org by slug and scopes every
// read/write to that orgId — a suspended org or wrong slug can't create or mutate bookings.

export type HoldResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot_taken" | "too_soon" | "invalid" | "unavailable" };

export async function holdSlotAction(
  slug: string,
  packageId: string,
  durationMin: number,
  startISO: string,
): Promise<HoldResult> {
  const org = await getActiveOrgBySlug(slug);
  if (!org || org.hostMemberIds.length === 0) return { ok: false, reason: "unavailable" };
  // Round-robin (SP-5.2): the host is auto-assigned inside the transaction; the seeker never picks one.
  const res = await assignAndReserveSlot({
    orgId: org.orgId,
    packageId,
    startsAt: new Date(startISO),
    durationMin,
  });
  if (res.ok) return { ok: true, bookingId: res.bookingId };
  return { ok: false, reason: res.reason === "no_host" ? "unavailable" : res.reason };
}

// Re-hold the same slot after a hold expired (creates a fresh held booking if still free).
export async function reholdAction(
  slug: string,
  packageId: string,
  durationMin: number,
  startISO: string,
): Promise<HoldResult> {
  return holdSlotAction(slug, packageId, durationMin, startISO);
}

export async function confirmBookingAction(
  slug: string,
  bookingId: string,
  details: SeekerDetails,
  answers: Record<string, string>,
): Promise<ConfirmResult> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return { ok: false, reason: "not_found" };
  return confirmBookingDetailsCore(org.orgId, bookingId, details, answers);
}

// ── Payment (SP-4.3) — all public, slug-scoped. Secrets decrypt only inside the cores, server-side. ──

export async function createGatewayOrderAction(slug: string, bookingId: string): Promise<CreateOrderCoreResult> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return { ok: false, error: "This page is unavailable." };
  return createGatewayOrderCore(org.orgId, bookingId);
}

export async function confirmGatewayPaymentAction(
  slug: string,
  bookingId: string,
  proof: { orderId: string; paymentId: string; signature: string },
): Promise<ConfirmPayResult> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return { ok: false, reason: "not_found" };
  return confirmGatewayPaymentCore(org.orgId, bookingId, proof);
}

// Upload the UPI proof to R2 (server-validates type+size), then record it → pending_verification.
export async function submitUpiProofAction(
  slug: string,
  bookingId: string,
  formData: FormData,
): Promise<ProofResult | { ok: false; reason: "invalid"; error: string }> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return { ok: false, reason: "not_found" };

  const file = formData.get("proof");
  if (!(file instanceof File)) return { ok: false, reason: "invalid", error: "Please attach your payment proof." };
  const check = validateProofFile(file.type, file.size);
  if (!check.ok) return { ok: false, reason: "invalid", error: check.error! };

  const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "png");
  const key = `payments/${org.orgId}/proofs/${bookingId}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await putObject({ key, body: bytes, contentType: file.type });

  const utr = String(formData.get("utr") ?? "").trim() || undefined;
  return submitUpiProofCore(org.orgId, bookingId, { proofImageKey: key, utrReference: utr });
}
