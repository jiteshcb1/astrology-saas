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
} from "@/lib/emails";

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

async function loadBooking(orgId: string, bookingId: string): Promise<BkPkgSlot | null> {
  return (await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, include: { package: true, slot: true } })) as BkPkgSlot | null;
}

export async function notifyBookingConfirmed(orgId: string, bookingId: string): Promise<void> {
  const [brand, booking] = await Promise.all([loadOrgBrand(orgId), loadBooking(orgId, bookingId)]);
  if (!brand || !booking?.package || !booking.seekerEmail) return;
  const when = booking.slot ? whenLabel(booking.slot.startsAt, brand.timezone) : "";
  const receiptUrl = `${BASE}/${brand.slug}/book/${bookingId}/receipt`;
  const calendarUrl = booking.slot
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${booking.package.title} with ${brand.consultantName}`)}&dates=${utcStamp(booking.slot.startsAt)}/${utcStamp(booking.slot.endsAt)}`
    : undefined;
  const mail = bookingConfirmedEmail({
    consultantName: brand.consultantName, logoUrl: brand.logoUrl, accent: brand.accent, locale: brand.locale,
    packageTitle: booking.package.title, whenLabel: when, amountLabel: formatMoney(booking.package.price), receiptUrl, calendarUrl,
  });
  await sendEmail({ to: booking.seekerEmail, type: "booking_confirmed", from: consultantFrom(brand.consultantName, env.EMAIL_FROM), replyTo: brand.ownerEmail ?? undefined, ...mail });
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
