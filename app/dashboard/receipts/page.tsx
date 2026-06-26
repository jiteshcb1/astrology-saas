import { requireSection } from "@/lib/rbac";
import { listOrgFinancials } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  const s = status.toLowerCase();
  if (s === "paid") return "success";
  if (s === "pending") return "warning";
  if (s === "failed") return "danger";
  return "neutral";
}
const STATUS_OPTIONS = ["all", "paid", "pending", "failed", "refunded"];

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  const { orgId } = await requireSection("finance");
  const { from, to, status } = await searchParams;
  const rows = await listOrgFinancials(orgId, { from, to, status });

  return (
    <>
      <PageHeader title="Receipts" subtitle="Payment records & receipts — no seeker details" />
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">From</span>
            <input type="date" name="from" defaultValue={from} className="rounded-control border border-line px-3 py-2 text-sm outline-none focus:border-marigold" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">To</span>
            <input type="date" name="to" defaultValue={to} className="rounded-control border border-line px-3 py-2 text-sm outline-none focus:border-marigold" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Status</span>
            <select name="status" defaultValue={status ?? "all"} className="rounded-control border border-line px-3 py-2 text-sm outline-none focus:border-marigold">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="capitalize">{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-marigold">Apply</button>
        </form>

        {rows.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No records" message="Payments and receipts will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.ref}-${i}`} className="border-b border-line last:border-0 hover:bg-sand-2/30">
                    <td className="px-4 py-3 text-muted">{fmt(r.dateISO)}</td>
                    <td className="px-4 py-3 capitalize text-ink">{r.type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{r.ref}</td>
                    <td className="px-4 py-3 text-ink">{formatMoney(r.amountPaise, r.currency)}</td>
                    <td className="px-4 py-3"><StatusChip label={r.status} tone={tone(r.status)} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.pdfUrl ? (
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-terra hover:underline">Download</a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
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
