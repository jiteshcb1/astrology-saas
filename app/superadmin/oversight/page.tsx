import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { listAllReceipts } from "@/lib/oversight";
import { formatMoney } from "@/lib/billing";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/superadmin/PageHeader";

// Read-only cross-tenant oversight (super-admin). Data is fetched via the sanctioned, audit-logged
// lib/oversight.ts. Bookings/seekers oversight arrives with those features (SP-4/SP-6).
export default async function OversightPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { session } = await requireRole("access:superadmin");
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam ?? "1") || 1, 1);

  const { items, total, pageSize } = await listAllReceipts(session.user.id, { page });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <PageHeader title="Oversight" />
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8">
        <p className="mb-6 text-sm text-muted">
          Read-only, audit-logged view across all organizations. Bookings &amp; seekers appear once
          those features ship.
        </p>

        <h2 className="mb-2 font-display text-lg text-ink">Receipts ({total})</h2>
        {items.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No receipts yet" message="Subscription receipts appear here as consultants are charged." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link className="hover:text-terra" href={`/superadmin/oversight?page=${page - 1}`}>
                  ← Prev
                </Link>
              )}
              {page < totalPages && (
                <Link className="hover:text-terra" href={`/superadmin/oversight?page=${page + 1}`}>
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
