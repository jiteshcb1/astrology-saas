import { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/tenant-db";
import { getActiveOrgBySlug } from "@/lib/public-page";
import { formatMoney } from "@/lib/money";

// Public, slug-scoped receipt resolver (SP-4.4). The receipt is rendered as a branded HTML page (no PDF
// — Workers-safe). Scoped to the active org by slug; verifies the receipt belongs to the booking.

export interface ReceiptView {
  receiptNumber: string;
  amountLabel: string;
  gstNumber: string | null;
  issuedAtISO: string;
  consultantName: string;
  logoUrl: string | null;
  accent: string | null;
  seekerName: string;
  packageTitle: string;
  durationLabel: string;
  startISO: string | null;
  timezone: string;
  status: string;
}

type BkPkgSlot = Prisma.BookingGetPayload<{ include: { package: true; slot: true } }>;

export async function getBookingReceipt(slug: string, bookingId: string): Promise<ReceiptView | null> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return null;
  const receipt = await tenantDb(org.orgId).receipt.findFirst({ where: { bookingId } });
  if (!receipt) return null;
  const booking = (await tenantDb(org.orgId).booking.findFirst({
    where: { id: bookingId },
    include: { package: true, slot: true },
  })) as BkPkgSlot | null;
  if (!booking || !booking.package) return null;

  return {
    receiptNumber: receipt.issuedTo,
    amountLabel: formatMoney(receipt.amount, receipt.currency),
    gstNumber: receipt.gstNumberUsed,
    issuedAtISO: receipt.issuedAt.toISOString(),
    consultantName: org.profile.displayName,
    logoUrl: org.branding.logoUrl,
    accent: org.branding.themeColor,
    seekerName: booking.seekerName ?? "",
    packageTitle: booking.package.title,
    durationLabel: `${booking.durationMin} min`,
    startISO: booking.slot ? booking.slot.startsAt.toISOString() : null,
    timezone: org.timezone,
    status: booking.status,
  };
}
