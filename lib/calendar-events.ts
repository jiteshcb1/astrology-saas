import type { Prisma } from "@prisma/client";
import { env, isDev } from "@/lib/env";
import { tenantDb } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { getCalendarIntegration, getValidToken } from "@/lib/calendar";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-oauth";
import { notifyMeetLinkFailed } from "@/lib/notifications";

// Track I T-1.3 — create/delete the Google Calendar event (+ Meet link) for a confirmed booking. Best-effort and
// post-commit: a calendar failure NEVER bubbles into the confirm flow (everything is wrapped, never throws). With
// no connected calendar it's a silent no-op (meetLink stays null). Tenant-scoped writes only.

type BookingForEvent = Prisma.BookingGetPayload<{ include: { package: true; slot: true } }>;

async function captureError(e: unknown, ctx: Record<string, unknown>): Promise<void> {
  if (isDev) console.error("[calendar-events]", ctx, e);
  if (env.SENTRY_DSN) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e, { extra: ctx });
    } catch {
      /* never let error reporting break the flow */
    }
  }
}

function buildEventBody(b: BookingForEvent, hostEmail: string | null): Record<string, unknown> {
  const seekerName = b.seekerName ?? "Seeker";
  const platform = env.PLATFORM_LEGAL_NAME || "Astro Consultancy";
  const attendees: { email: string }[] = [];
  if (b.seekerEmail) attendees.push({ email: b.seekerEmail });
  if (hostEmail) attendees.push({ email: hostEmail });
  return {
    summary: `${b.package.title} with ${seekerName}`,
    description:
      `Consultation booking via ${platform}\n\n` +
      `Seeker: ${seekerName}${b.seekerEmail ? ` (${b.seekerEmail})` : ""}\n` +
      `Package: ${b.package.title}\n` +
      `Duration: ${b.durationMin} minutes\n` +
      `Booking ref: ${b.id}`,
    start: { dateTime: b.slot!.startsAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: b.slot!.endsAt.toISOString(), timeZone: "UTC" },
    attendees,
    // requestId = booking id → Google returns the same conference for retries (Meet-link idempotency).
    conferenceData: { createRequest: { requestId: b.id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
  };
}

// Create the host's calendar event for a confirmed booking and store meetLink + calendarEventId. Idempotent (skips
// if an event already exists) and graceful (no calendar / refresh failure → return, booking stays confirmed).
export async function ensureMeetLink(orgId: string, bookingId: string): Promise<void> {
  try {
    const b = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true, slot: true } })) as BookingForEvent | null;
    if (!b || !b.package || !b.slot) return; // need a scheduled slot
    if (b.calendarEventId) return; // idempotent — event already created
    if (b.status !== "confirmed") return; // only confirmed bookings get an event
    if (!b.assignedMemberId) return; // no host

    const ci = await getCalendarIntegration(orgId, b.assignedMemberId);
    if (!ci || ci.status !== "active") return; // no calendar connected → graceful (meetLink stays null)
    const tok = await getValidToken(orgId, b.assignedMemberId);
    if (!tok.ok) return; // token refresh failed → graceful

    const created = await createCalendarEvent(tok.accessToken, ci.calendarId ?? "primary", buildEventBody(b, ci.googleEmail));
    if (!created) {
      await captureError(new Error("createCalendarEvent failed"), { orgId, bookingId });
      await notifyMeetLinkFailed(orgId, bookingId); // tell the consultant to send the link manually
      return; // booking remains confirmed; meetLink null
    }
    await tenantDb(orgId).booking.updateMany({ where: { id: bookingId }, data: { meetLink: created.meetLink, calendarEventId: created.id } });
    await writeAuditLog({ actorUserId: null, action: "booking.meet_link.created", resourceType: "booking", resourceId: bookingId, orgId, metadata: { hasMeetLink: Boolean(created.meetLink) } });
  } catch (e) {
    await captureError(e, { orgId, bookingId, where: "ensureMeetLink" }); // never break the confirm flow
  }
}

// SP-7.1 — after a (re)connect, create Meet links for the member's recent UPCOMING confirmed bookings that
// don't have one yet (e.g. bookings confirmed BEFORE the calendar was connected). Best-effort; never throws.
export async function backfillMeetLinksForMember(orgId: string, memberId: string): Promise<void> {
  try {
    const bookings = await tenantDb(orgId).booking.findMany({
      where: { assignedMemberId: memberId, status: "confirmed", calendarEventId: null, slot: { is: { startsAt: { gt: new Date() } } } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true },
    });
    for (const b of bookings) await ensureMeetLink(orgId, b.id);
  } catch (e) {
    await captureError(e, { orgId, memberId, where: "backfillMeetLinksForMember" });
  }
}

// Best-effort delete of a confirmed booking's calendar event (for a future confirmed-cancel/refund/reschedule flow).
// Clears calendarEventId but KEEPS meetLink so past records stay readable.
export async function deleteBookingCalendarEvent(orgId: string, bookingId: string, actorUserId: string | null = null): Promise<void> {
  try {
    const b = (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId } })) as { assignedMemberId: string | null; calendarEventId: string | null } | null;
    if (!b || !b.calendarEventId || !b.assignedMemberId) return;

    const ci = await getCalendarIntegration(orgId, b.assignedMemberId);
    if (ci && ci.status === "active") {
      const tok = await getValidToken(orgId, b.assignedMemberId);
      if (tok.ok) await deleteCalendarEvent(tok.accessToken, ci.calendarId ?? "primary", b.calendarEventId);
    }
    await tenantDb(orgId).booking.updateMany({ where: { id: bookingId }, data: { calendarEventId: null } });
    await writeAuditLog({ actorUserId, action: "booking.meet_link.deleted", resourceType: "booking", resourceId: bookingId, orgId, metadata: {} });
  } catch (e) {
    await captureError(e, { orgId, bookingId, where: "deleteBookingCalendarEvent" });
  }
}
