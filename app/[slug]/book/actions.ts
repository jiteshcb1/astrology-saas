"use server";

import { getActiveOrgBySlug } from "@/lib/public-page";
import { reserveSlot } from "@/lib/scheduling";
import { confirmBookingDetailsCore, type ConfirmResult, type SeekerDetails } from "@/lib/booking";

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
  if (!org || !org.hostMemberId) return { ok: false, reason: "unavailable" };
  const res = await reserveSlot({
    orgId: org.orgId,
    packageId,
    hostMemberId: org.hostMemberId,
    startsAt: new Date(startISO),
    durationMin,
  });
  return res.ok ? { ok: true, bookingId: res.bookingId } : { ok: false, reason: res.reason };
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
