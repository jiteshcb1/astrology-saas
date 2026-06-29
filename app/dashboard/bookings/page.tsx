import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { listConsultantBookings } from "@/lib/payment";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { BookingsList, type BookingRow } from "@/components/dashboard/BookingsList";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ filter?: string; package?: string }> }) {
  const { role, orgId } = await requireSection("bookings_manage");
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const { filter, package: pkgId } = await searchParams;
  let bookings = orgId ? await listConsultantBookings(orgId) : [];
  // SP-5.6: stat cards / the bookings-by-package chart deep-link here with a filter.
  const now = new Date().getTime();
  if (filter === "upcoming") bookings = bookings.filter((b) => b.slot && b.slot.startsAt.getTime() > now);
  if (pkgId) bookings = bookings.filter((b) => b.package.id === pkgId);
  const filterLabel = filter === "upcoming" ? "Upcoming only" : pkgId ? `Package: ${bookings[0]?.package.title ?? "filtered"}` : null;

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
    meetLink: b.meetLink ?? null,
  }));

  return (
    <>
      <PageHeader title="Bookings" subtitle="Verify payments and manage your consultations" />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {filterLabel && (
          <div className="mb-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-marigold/15 px-3 py-1 text-ink">{filterLabel}</span>
            <Link href="/dashboard/bookings" className="text-terra hover:underline">Clear filter</Link>
          </div>
        )}
        <BookingsList rows={rows} />
      </div>
    </>
  );
}
