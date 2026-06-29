"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { tenantDb } from "@/lib/tenant-db";
import { getCalendarIntegration } from "@/lib/calendar";
import { ensureMeetLink } from "@/lib/calendar-events";
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

// SP-7.1 — manually (re)generate the Google Meet link for a confirmed booking. Fixes bookings that were
// confirmed BEFORE the calendar was connected (ensureMeetLink only runs at confirmation time). Idempotent.
export async function generateMeetLinkAction(
  bookingId: string,
): Promise<{ ok: boolean; meetLink?: string | null; reason?: string }> {
  const { orgId } = await requireSection("bookings_manage");
  if (!orgId) return { ok: false, reason: "no_org" };
  const b = await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, select: { status: true, assignedMemberId: true, meetLink: true } });
  if (!b) return { ok: false, reason: "not_found" };
  if (b.meetLink) return { ok: true, meetLink: b.meetLink };
  if (b.status !== "confirmed") return { ok: false, reason: "not_confirmed" };
  if (!b.assignedMemberId) return { ok: false, reason: "no_host" };
  const ci = await getCalendarIntegration(orgId, b.assignedMemberId);
  if (!ci || ci.status !== "active") return { ok: false, reason: "no_calendar" };
  await ensureMeetLink(orgId, bookingId);
  const after = await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, select: { meetLink: true } });
  revalidatePath("/dashboard/bookings");
  return after?.meetLink ? { ok: true, meetLink: after.meetLink } : { ok: false, reason: "failed" };
}
