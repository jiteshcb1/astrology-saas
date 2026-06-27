import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { getBranding } from "@/lib/branding";
import { getProfile } from "@/lib/consultant-profile";
import { getSignedUrl } from "@/lib/storage";
import { formatMoney } from "@/lib/money";
import { env, isDev } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import {
  consultantFrom,
  bookingConfirmedEmail,
  proofReceivedEmail,
  bookingDeclinedEmail,
  newBookingConsultantEmail,
  consultantWelcomeEmail,
  orgInviteEmail,
  meetLinkFailedEmail,
  newLeadEmail,
  leadAckEmail,
} from "@/lib/emails";
import { resolveSuperadminEmail } from "@/lib/superadmin";
import { waLink } from "@/lib/leads";
import type { Lead } from "@prisma/client";

// Server-side notification senders (SP-4.4). Each assembles consultant branding + booking data and sends
// via Resend. Called AFTER the relevant transaction commits. Never throws (sendEmail swallows failures),
// so a mail problem can never break a booking/payment flow.

const BASE = env.AUTH_URL.replace(/\/$/, "");
type BkPkgSlot = Prisma.BookingGetPayload<{ include: { package: true; slot: true } }>;

interface OrgBrand {
  slug: string;
  orgName: string;
  ownerEmail: string | null;
  consultantName: string;
  logoUrl: string | null;
  accent: string | null;
  locale: string;
  contact: string | null;
  timezone: string;
}

async function loadOrgBrand(orgId: string): Promise<OrgBrand | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true, name: true, ownerUserId: true } });
  if (!org) return null;
  const [owner, branding, profile] = await Promise.all([
    org.ownerUserId ? prisma.user.findUnique({ where: { id: org.ownerUserId }, select: { email: true } }) : Promise.resolve(null),
    getBranding(orgId),
    getProfile(orgId),
  ]);
  return {
    slug: org.slug,
    orgName: org.name,
    ownerEmail: owner?.email ?? null,
    consultantName: profile?.displayName || org.name,
    logoUrl: branding?.logoKey ? await getSignedUrl(branding.logoKey, 604800) : null, // 7-day link for email
    accent: branding?.themeColor ?? null,
    locale: branding?.defaultLocale ?? "en",
    contact: profile?.complaintsContactNumber ?? null,
    timezone: profile?.timezone ?? "Asia/Kolkata",
  };
}

function whenLabel(date: Date, tz: string): string {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
  const t = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
  return `${d} · ${t}`;
}
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// T-1.4: Google "add to calendar" URL (this codebase's SP-4.4 calendar entry — not an .ics attachment). Carries
// the Meet link as the event location + details when available.
export function buildAddToCalendarUrl(text: string, startsAt: Date, endsAt: Date, meetLink?: string | null): string {
  const extra = meetLink ? `&location=${encodeURIComponent("Google Meet")}&details=${encodeURIComponent(`Join: ${meetLink}`)}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${utcStamp(startsAt)}/${utcStamp(endsAt)}${extra}`;
}

async function loadBooking(orgId: string, bookingId: string): Promise<BkPkgSlot | null> {
  return (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true, slot: true } })) as BkPkgSlot | null;
}

export async function notifyBookingConfirmed(orgId: string, bookingId: string): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand || !booking?.package || !booking.seekerEmail) return;
  const when = booking.slot ? whenLabel(booking.slot.startsAt, brand.timezone) : "";
  const receiptUrl = `${BASE}/${brand.slug}/book/${bookingId}/receipt`;
  const calendarUrl = booking.slot
    ? buildAddToCalendarUrl(`${booking.package.title} with ${brand.consultantName}`, booking.slot.startsAt, booking.slot.endsAt, booking.meetLink)
    : undefined;
  const mail = bookingConfirmedEmail({
    consultantName: brand.consultantName, logoUrl: brand.logoUrl, accent: brand.accent, locale: brand.locale,
    packageTitle: booking.package.title, whenLabel: when, amountLabel: formatMoney(booking.package.price), receiptUrl, calendarUrl,
    meetLink: booking.meetLink, // T-1.3: set by ensureMeetLink (which runs before this); stub line when null
  });
  await sendEmail({ to: booking.seekerEmail, type: "booking_confirmed", from: consultantFrom(brand.consultantName, env.EMAIL_FROM), replyTo: brand.ownerEmail ?? undefined, ...mail });
}

// T-1.3 — consultant alert when ensureMeetLink couldn't auto-generate a Meet link for a confirmed booking.
export async function notifyMeetLinkFailed(orgId: string, bookingId: string): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand?.ownerEmail || !booking?.package) return;
  const when = booking.slot ? whenLabel(booking.slot.startsAt, brand.timezone) : "";
  const mail = meetLinkFailedEmail({
    seekerName: booking.seekerName ?? "the seeker", packageTitle: booking.package.title, whenLabel: when, bookingsUrl: `${BASE}/dashboard/bookings`,
  });
  await sendEmail({ to: brand.ownerEmail, type: "meet_link_failed", ...mail });
}

export async function notifyProofReceived(orgId: string, bookingId: string): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand || !booking?.package || !booking.seekerEmail) return;
  const when = booking.slot ? whenLabel(booking.slot.startsAt, brand.timezone) : "";
  const mail = proofReceivedEmail({
    consultantName: brand.consultantName, logoUrl: brand.logoUrl, accent: brand.accent, locale: brand.locale,
    packageTitle: booking.package.title, whenLabel: when,
  });
  await sendEmail({ to: booking.seekerEmail, type: "proof_received", from: consultantFrom(brand.consultantName, env.EMAIL_FROM), replyTo: brand.ownerEmail ?? undefined, ...mail });
}

export async function notifyBookingDeclined(orgId: string, bookingId: string): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand || !booking?.package || !booking.seekerEmail) return;
  const mail = bookingDeclinedEmail({
    consultantName: brand.consultantName, logoUrl: brand.logoUrl, accent: brand.accent, locale: brand.locale,
    packageTitle: booking.package.title, rebookUrl: `${BASE}/${brand.slug}`, contact: brand.contact,
  });
  await sendEmail({ to: booking.seekerEmail, type: "booking_declined", from: consultantFrom(brand.consultantName, env.EMAIL_FROM), replyTo: brand.ownerEmail ?? undefined, ...mail });
}

export async function notifyNewBooking(orgId: string, bookingId: string, mode: "upi_qr" | "gateway"): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand?.ownerEmail || !booking?.package) return;
  const when = booking.slot ? whenLabel(booking.slot.startsAt, brand.timezone) : "";
  const mail = newBookingConsultantEmail({
    seekerName: booking.seekerName ?? "A seeker", packageTitle: booking.package.title, whenLabel: when,
    amountLabel: formatMoney(booking.package.price), mode, bookingsUrl: `${BASE}/dashboard/bookings`,
    meetLink: booking.meetLink, // T-1.4: reflects calendar status (set when gateway-confirmed before this fires)
  });
  await sendEmail({ to: brand.ownerEmail, type: "new_booking", ...mail });
}

export async function notifyConsultantWelcome(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, ownerUserId: true } });
  if (!org?.ownerUserId) return;
  const owner = await prisma.user.findUnique({ where: { id: org.ownerUserId }, select: { email: true } });
  if (!owner?.email) return;
  const mail = consultantWelcomeEmail({ orgName: org.name, signInUrl: `${BASE}/signin` });
  await sendEmail({ to: owner.email, type: "consultant_welcome", ...mail });
}

// SP-5.1 team invite. inviteUrl carries the RAW token (hashed at rest). Dev-logs the URL like [otp:dev]
// so the flow works with the Resend stub.
export async function notifyOrgInvite(p: { orgId: string; email: string; roleLabel: string; message?: string | null; inviteUrl: string }): Promise<void> {
  const org = await prisma.organization.findUnique({ where: { id: p.orgId }, select: { name: true, ownerUserId: true } });
  if (!org) return;
  const inviter = org.ownerUserId ? await prisma.user.findUnique({ where: { id: org.ownerUserId }, select: { name: true } }) : null;
  const mail = orgInviteEmail({ inviterName: inviter?.name || org.name, orgName: org.name, roleLabel: p.roleLabel, message: p.message, inviteUrl: p.inviteUrl });
  await sendEmail({ to: p.email, type: "org_invite", ...mail });
  if (isDev) console.log(`[invite:dev] invite URL for ${p.email}: ${p.inviteUrl}`);
}

// ── Lead capture (SP-6.3) — best-effort; sendEmail never throws and is suppressed by the global pause. ──
export async function notifyNewLead(lead: Lead): Promise<void> {
  const to = resolveSuperadminEmail(process.env.SUPERADMIN_EMAIL, process.env.NODE_ENV);
  const mail = newLeadEmail({
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    practiceType: lead.practiceType,
    heardFrom: lead.heardFrom,
    message: lead.message,
    waUrl: waLink(lead.whatsapp),
    isRepeat: lead.createdAt.getTime() !== lead.updatedAt.getTime(),
  });
  await sendEmail({ to, type: "lead_notification", replyTo: lead.email, ...mail });
}

export async function notifyLeadAck(lead: Lead): Promise<void> {
  const replyTo = resolveSuperadminEmail(process.env.SUPERADMIN_EMAIL, process.env.NODE_ENV);
  await sendEmail({ to: lead.email, type: "lead_ack", replyTo, ...leadAckEmail({ name: lead.name }) });
}
