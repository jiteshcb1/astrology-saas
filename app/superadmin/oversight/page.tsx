import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { listAllBookings, listAllReceipts, resolveConsultant, bookingStatusTone } from "@/lib/oversight";
import { formatMoney } from "@/lib/billing";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";

function fmt(date: Date | null | undefined, timeZone = "Asia/Kolkata"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(date);
}

// Read-only cross-tenant oversight (super-admin), via the sanctioned, audit-logged lib/oversight.ts.
export default async function OversightPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { session } = await requireRole("access:superadmin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);

  const calls = await listAllBookings(session.user.id, { page });
  const receipts = await listAllReceipts(session.user.id, { page: 1, pageSize: 10 });
  const totalPages = Math.max(Math.ceil(calls.total / calls.pageSize), 1);

  return (
    <>
      <PageHeader title="Oversight" subtitle="Read-only, audit-logged view across all organizations" />
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
        <h2 className="mb-2 font-display text-lg text-ink">Calls ({calls.total})</h2>
        {calls.items.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No calls yet" message="Bookings across all consultants appear here as seekers book." />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Booking ID</th>
                  <th className="px-4 py-2.5 font-medium">Payment ID</th>
                  <th className="px-4 py-2.5 font-medium">Consultant</th>
                  <th className="px-4 py-2.5 font-medium">Seeker</th>
                  <th className="px-4 py-2.5 font-medium">Booking time</th>
                  <th className="px-4 py-2.5 font-medium">Call time</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.items.map((b) => {
                  const c = resolveConsultant(b.organization);
                  return (
                    <tr key={b.id} className="border-b border-line align-top transition last:border-0 hover:bg-sand-2/30">
                      <td className="px-4 py-3">
                        <Link href={`/superadmin/oversight/${b.id}`} className="font-mono text-xs text-ink hover:text-terra">{b.id.slice(0, 10)}…</Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{b.payment ? `${b.payment.id.slice(0, 10)}…` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="text-ink">{c.name}</div>
                        <div className="text-xs text-muted">{c.email}</div>
                        <div className="text-xs text-muted">{c.contact}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-ink">{b.seekerName || "—"}</div>
                        <div className="text-xs text-muted">{b.seekerEmail || "—"}</div>
                        <div className="text-xs text-muted">{b.seekerPhone || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{fmt(b.createdAt, c.timezone)}</td>
                      <td className="px-4 py-3 text-xs text-muted">{fmt(b.slot?.startsAt ?? null, c.timezone)}</td>
                      <td className="px-4 py-3"><StatusChip label={b.status.replace(/_/g, " ")} tone={bookingStatusTone(b.status)} /></td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/superadmin/oversight/${b.id}`} className="inline-block rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-3">
              {page > 1 && <Link className="hover:text-terra" href={`/superadmin/oversight?page=${page - 1}`}>← Prev</Link>}
              {page < totalPages && <Link className="hover:text-terra" href={`/superadmin/oversight?page=${page + 1}`}>Next →</Link>}
            </div>
          </div>
        )}

        <h2 className="mb-2 mt-10 font-display text-lg text-ink">Recent receipts ({receipts.total})</h2>
        {receipts.items.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No receipts yet" message="Subscription receipts appear here as consultants are charged." />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Organization</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Issued</th>
                </tr>
              </thead>
              <tbody>
                {receipts.items.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-ink">{r.organization.name}</td>
                    <td className="px-4 py-3 text-muted">{r.type}</td>
                    <td className="px-4 py-3">{formatMoney(r.amount, r.currency)}</td>
                    <td className="px-4 py-3 text-muted">{r.issuedAt.toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
