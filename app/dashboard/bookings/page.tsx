import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { listConsultantBookings } from "@/lib/payment";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { BookingsList, type BookingRow } from "@/components/dashboard/BookingsList";

export default async function BookingsPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const bookings = orgId ? await listConsultantBookings(orgId) : [];
  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    packageTitle: b.package.title,
    seekerName: b.seekerName ?? "—",
    seekerEmail: b.seekerEmail ?? "",
    seekerPhone: b.seekerPhone ?? "",
    startISO: b.slot ? b.slot.startsAt.toISOString() : null,
    priceLabel: formatMoney(b.package.price),
    paymentMode: b.payment?.mode ?? null,
    utr: b.payment?.utrReference ?? null,
    hasProof: Boolean(b.payment?.proofImageKey),
  }));

  return (
    <>
      <PageHeader title="Bookings" subtitle="Verify payments and manage your consultations" />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <BookingsList rows={rows} />
      </div>
    </>
  );
}
