import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, waLink, LEAD_STATUSES } from "@/lib/leads";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { StatusChip, leadStatusTone, leadStatusLabel } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { updateLeadStatusAction } from "../actions";

const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(d);

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <>
      <PageHeader title={lead.name}>
        <StatusChip label={leadStatusLabel(lead.status)} tone={leadStatusTone(lead.status)} />
      </PageHeader>
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/superadmin/leads" className="text-sm text-terra hover:underline">← Back to leads</Link>

        <div className="mt-4 space-y-5 rounded-card border border-line bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Email">{lead.email}</ReadOnlyField>
            <ReadOnlyField label="WhatsApp">{lead.whatsapp}</ReadOnlyField>
            <ReadOnlyField label="Type of practice">{lead.practiceType ?? "—"}</ReadOnlyField>
            <ReadOnlyField label="How they heard about us">{lead.heardFrom ?? "—"}</ReadOnlyField>
            <ReadOnlyField label="Submitted">{fmtDateTime(lead.createdAt)}</ReadOnlyField>
            <ReadOnlyField label="Last updated">{fmtDateTime(lead.updatedAt)}</ReadOnlyField>
          </div>
          <ReadOnlyField label="Message">{lead.message ? <span className="whitespace-pre-line">{lead.message}</span> : "—"}</ReadOnlyField>

          <a href={waLink(lead.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-control bg-green/15 px-4 py-2.5 text-sm font-medium text-green transition hover:bg-green/25">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.6 14.2c-.2.7-1.3 1.3-1.8 1.3-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.2.6 1 1.4 1.6 1 .8 1.7 1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.8-.1 1.5z" /></svg>
            Message on WhatsApp
          </a>
        </div>

        <form action={updateLeadStatusAction} className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-line bg-white p-6">
          <input type="hidden" name="leadId" value={lead.id} />
          <div className="min-w-[200px] flex-1">
            <Select name="status" label="Pipeline status" defaultValue={lead.status}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{leadStatusLabel(s)}</option>)}
            </Select>
          </div>
          <Button type="submit">Update status</Button>
        </form>
      </div>
    </>
  );
}
