import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { listAllReceipts } from "@/lib/oversight";
import { formatMoney } from "@/lib/billing";

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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="font-display text-2xl text-ink">Oversight</h1>
      <p className="mb-6 text-sm text-muted">
        Read-only, audit-logged view across all organizations. Bookings &amp; seekers appear once
        those features ship.
      </p>

      <h2 className="mb-2 font-display text-lg text-ink">Receipts ({total})</h2>
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
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={4}>
                  No receipts yet.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{r.organization.name}</td>
                  <td className="px-4 py-3 text-muted">{r.type}</td>
                  <td className="px-4 py-3">{formatMoney(r.amount, r.currency)}</td>
                  <td className="px-4 py-3 text-muted">{r.issuedAt.toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </main>
  );
}
