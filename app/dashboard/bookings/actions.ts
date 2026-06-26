"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { verifyBookingPaymentCore, getProofUrl, type VerifyResult } from "@/lib/payment";

export async function verifyBookingAction(bookingId: string, decision: "confirm" | "reject"): Promise<VerifyResult> {
  const { session, orgId } = await requireSection("bookings_manage");
  if (!orgId) return { ok: false, error: "No organization is linked to your account." };
  const res = await verifyBookingPaymentCore(orgId, bookingId, decision, session.user.id);
  revalidatePath("/dashboard/bookings");
  return res;
}

// Server-issued presigned URL for the proof — only reachable by an authorized consultant/team member.
export async function getProofUrlAction(bookingId: string): Promise<string | null> {
  const { orgId } = await requireSection("bookings_manage");
  if (!orgId) return null;
  return getProofUrl(orgId, bookingId);
}
