import Link from "next/link";
import { listLeads, waLink, LEAD_STATUSES } from "@/lib/leads";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip, leadStatusTone, leadStatusLabel } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);

const FILTERS = ["all", ...LEAD_STATUSES] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const active = filter && (LEAD_STATUSES as readonly string[]).includes(filter) ? filter : "all";
  const leads = await listLeads(active === "all" ? undefined : active);

  return (
    <>
      <PageHeader title="Leads" />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = f === active;
            const href = f === "all" ? "/superadmin/leads" : `/superadmin/leads?filter=${f}`;
            return (
              <Link key={f} href={href} className={`rounded-full px-3 py-1 text-sm capitalize transition ${isActive ? "bg-marigold text-night" : "border border-line text-muted hover:border-marigold"}`}>
                {f === "all" ? "All" : leadStatusLabel(f)}
              </Link>
            );
          })}
        </div>

        {leads.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No leads yet" message="Leads from the public “Book a free demo” form will appear here." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Practice</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-line transition last:border-0 hover:bg-sand-2/30">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/leads/${lead.id}`}>{lead.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div>{lead.email}</div>
                      <div className="text-xs">{lead.whatsapp}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.practiceType ?? "—"}</td>
                    <td className="px-4 py-3"><StatusChip label={leadStatusLabel(lead.status)} tone={leadStatusTone(lead.status)} /></td>
                    <td className="px-4 py-3 text-muted">{fmtDate(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a href={waLink(lead.whatsapp)} target="_blank" rel="noreferrer" className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">WhatsApp</a>
                        <Link href={`/superadmin/leads/${lead.id}`} className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">Open</Link>
                      </div>
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
