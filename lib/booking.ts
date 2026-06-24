import { Prisma } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
import { getActiveOrgBySlug } from "@/lib/public-page";
import { getPackageQuestions } from "@/lib/packages";
import { type IntakeQuestion, type SeekerDetails, validateIntake, validateSeeker } from "@/lib/booking-validate";

// Booking cores (SP-4.2). The public seeker flow: hold (reserveSlot) → fill details + intake answers →
// confirm (this keeps the hold and moves to pending_payment; payment is SP-4.3). All reads/writes are
// scoped to the slug's active org; pure validators live in lib/booking-validate (client-safe).

export { isValidEmail, isValidPhone, validateIntake, validateSeeker } from "@/lib/booking-validate";
export type { IntakeQuestion, SeekerDetails } from "@/lib/booking-validate";

export interface HeldBookingView {
  bookingId: string;
  orgId: string;
  slug: string;
  status: string;
  holdExpiresAtISO: string | null;
  startISO: string;
  endISO: string;
  durationMin: number;
  timezone: string;
  consultant: { displayName: string; logoUrl: string | null; themeColor: string | null };
  package: { id: string; title: string; priceLabel: string; durationLabel: string };
  questions: IntakeQuestion[];
  seeker: { name: string; email: string; phone: string };
}

// Public resolver for the booking page. Returns null for unknown booking / org mismatch / suspended org.
// Returns the view even when expired/confirmed so the UI can render the right state.
export async function getHeldBooking(slug: string, bookingId: string): Promise<HeldBookingView | null> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return null;
  // The generic tenant facade doesn't narrow `include`, so type the payload explicitly.
  type BookingWithRels = Prisma.BookingGetPayload<{ include: { slot: true; package: true } }>;
  const booking = (await tenantDb(org.orgId).booking.findFirst({
    where: { id: bookingId },
    include: { slot: true, package: true },
  })) as BookingWithRels | null;
  if (!booking || !booking.slot || !booking.package) return null;

  const questions = await getPackageQuestions(org.orgId, booking.packageId);
  return {
    bookingId: booking.id,
    orgId: org.orgId,
    slug: org.slug,
    status: booking.status,
    holdExpiresAtISO: booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null,
    startISO: booking.slot.startsAt.toISOString(),
    endISO: booking.slot.endsAt.toISOString(),
    durationMin: booking.durationMin,
    timezone: org.timezone,
    consultant: { displayName: org.profile.displayName, logoUrl: org.branding.logoUrl, themeColor: org.branding.themeColor },
    package: {
      id: booking.package.id,
      title: booking.package.title,
      priceLabel: formatMoney(booking.package.price),
      durationLabel: `${booking.durationMin} min`,
    },
    questions: questions.map((q) => ({
      id: q.id,
      label: q.label,
      fieldType: q.fieldType,
      requirement: q.requirement,
      options: (q.options as string[]) ?? [],
    })),
    seeker: { name: booking.seekerName ?? "", email: booking.seekerEmail ?? "", phone: booking.seekerPhone ?? "" },
  };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: "validation"; errors: Record<string, string> }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "not_found" };

// Save seeker details + intake answers onto a still-valid hold and move held → pending_payment. Uses a
// conditional update (status held/pending_payment AND holdExpiresAt > now) so a lapsed hold fails safely.
export async function confirmBookingDetailsCore(
  orgId: string,
  bookingId: string,
  details: SeekerDetails,
  answers: Record<string, string>,
  now: Date = new Date(),
): Promise<ConfirmResult> {
  const booking = await tenantDb(orgId).booking.findFirst({ where: { id: bookingId }, select: { id: true, packageId: true } });
  if (!booking) return { ok: false, reason: "not_found" };

  const rawQuestions = await getPackageQuestions(orgId, booking.packageId);
  const questions: IntakeQuestion[] = rawQuestions.map((q) => ({
    id: q.id,
    label: q.label,
    fieldType: q.fieldType,
    requirement: q.requirement,
    options: (q.options as string[]) ?? [],
  }));

  const errors = { ...validateSeeker(details), ...validateIntake(questions, answers) };
  if (Object.keys(errors).length > 0) return { ok: false, reason: "validation", errors };

  // Persist answers with labels (robust if questions change later).
  const responses = questions
    .filter((q) => q.requirement !== "hidden")
    .map((q) => ({ questionId: q.id, label: q.label, value: (answers[q.id] ?? "").toString().trim() }));

  const claimed = await tenantTransaction(async ({ db, tenant }) => {
    const res = await tenant(orgId).booking.updateMany({
      where: { id: bookingId, status: { in: ["held", "pending_payment"] }, holdExpiresAt: { gt: now } },
      data: {
        seekerName: details.name.trim(),
        seekerEmail: details.email.trim(),
        seekerPhone: details.phone.trim(),
        answers: { responses } as Prisma.InputJsonValue,
        tosAcceptedAt: now,
        status: "pending_payment",
      },
    });
    if (res.count !== 1) return false;
    await writeAuditLog(
      { actorUserId: null, action: "booking.confirm", resourceType: "booking", resourceId: bookingId, orgId },
      db,
    );
    return true;
  });

  return claimed ? { ok: true } : { ok: false, reason: "expired" };
}
