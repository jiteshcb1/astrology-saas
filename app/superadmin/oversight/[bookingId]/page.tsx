import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getBookingDetail, resolveConsultant, bookingStatusTone } from "@/lib/oversight";
import { formatMoney } from "@/lib/billing";
import { getSignedUrl } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { PageHeader } from "@/components/superadmin/PageHeader";

function fmt(date: Date | null | undefined, timeZone = "Asia/Kolkata"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(date);
}
function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
type Answer = { label?: string; value?: unknown; questionId?: string };
function parseAnswers(answers: unknown): Answer[] {
  if (answers && typeof answers === "object" && Array.isArray((answers as { responses?: unknown }).responses)) {
    return (answers as { responses: Answer[] }).responses;
  }
  return [];
}

export default async function OversightBookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { session } = await requireRole("access:superadmin");
  const { bookingId } = await params;
  const detail = await getBookingDetail(session.user.id, bookingId);
  if (!detail) notFound();

  const { booking: b, receipt } = detail;
  const c = resolveConsultant(b.organization);
  const tz = c.timezone;
  const answers = parseAnswers(b.answers);
  const pay = b.payment;
  const priceLabel = pay ? formatMoney(pay.amount, pay.currency) : formatMoney(b.package.price, b.package.currency);
  const proofUrl = pay?.proofImageKey ? await getSignedUrl(pay.proofImageKey) : null;

  return (
    <>
      <PageHeader title="Call details">
        <StatusChip label={b.status.replace(/_/g, " ")} tone={bookingStatusTone(b.status)} />
      </PageHeader>
      <div className="mx-auto w-full max-w-3xl px-6 py-6">
        <Link href="/superadmin/oversight" className="text-sm text-muted hover:text-terra">← Oversight</Link>
        <p className="mt-2 font-mono text-xs text-muted">{b.id}</p>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Service</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Package">{b.package.title}</ReadOnlyField>
              <ReadOnlyField label="Platform">{humanize(b.package.locationType)}</ReadOnlyField>
              <ReadOnlyField label="Duration">{b.durationMin} min</ReadOnlyField>
              <ReadOnlyField label="Price">{priceLabel}</ReadOnlyField>
            </div>
            <ReadOnlyField label="Meeting link">{b.meetLink ? <a href={b.meetLink} target="_blank" rel="noreferrer" className="break-all text-terra underline">{b.meetLink}</a> : "—"}</ReadOnlyField>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Consultant</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Name">{c.name}</ReadOnlyField>
            <ReadOnlyField label="Organization">{b.organization.name} (/{b.organization.slug})</ReadOnlyField>
            <ReadOnlyField label="Email">{c.email}</ReadOnlyField>
            <ReadOnlyField label="Contact">{c.contact}</ReadOnlyField>
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Seeker</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Name">{b.seekerName || "—"}</ReadOnlyField>
            <ReadOnlyField label="Email">{b.seekerEmail || "—"}</ReadOnlyField>
            <ReadOnlyField label="Phone">{b.seekerPhone || "—"}</ReadOnlyField>
            <ReadOnlyField label="Account">{b.seekerUserId ? "Registered" : "Guest"}</ReadOnlyField>
          </div>
          {answers.length > 0 && (
            <div className="mt-3">
              <span className="mb-1.5 block text-sm text-muted">Intake answers</span>
              <div className="space-y-2 rounded-control border border-line bg-sand-2/40 px-4 py-3 text-sm">
                {answers.map((a, i) => (
                  <div key={i}>
                    <span className="text-muted">{a.label ?? a.questionId ?? `Q${i + 1}`}: </span>
                    <span className="text-ink">{String(a.value ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Payment</h2>
          {pay ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReadOnlyField label="Payment ID"><span className="break-all font-mono text-xs">{pay.id}</span></ReadOnlyField>
                <ReadOnlyField label="Mode">{humanize(pay.mode)}</ReadOnlyField>
                <ReadOnlyField label="Amount">{formatMoney(pay.amount, pay.currency)}</ReadOnlyField>
                <ReadOnlyField label="Status"><StatusChip label={pay.status.replace(/_/g, " ")} tone={bookingStatusTone(pay.status === "success" ? "confirmed" : pay.status)} /></ReadOnlyField>
                {pay.utrReference && <ReadOnlyField label="UTR reference">{pay.utrReference}</ReadOnlyField>}
                {pay.gatewayOrderId && <ReadOnlyField label="Gateway order ID"><span className="break-all font-mono text-xs">{pay.gatewayOrderId}</span></ReadOnlyField>}
                {pay.gatewayPaymentRef && <ReadOnlyField label="Gateway payment ref"><span className="break-all font-mono text-xs">{pay.gatewayPaymentRef}</span></ReadOnlyField>}
                {pay.verifiedByUserId && <ReadOnlyField label="Verified by (user)"><span className="break-all font-mono text-xs">{pay.verifiedByUserId}</span></ReadOnlyField>}
                <ReadOnlyField label="Created">{fmt(pay.createdAt, tz)}</ReadOnlyField>
              </div>
              {proofUrl && <ReadOnlyField label="Payment proof"><a href={proofUrl} target="_blank" rel="noreferrer" className="text-terra underline">View proof</a></ReadOnlyField>}
              {receipt && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReadOnlyField label="Receipt no.">{receipt.issuedTo}</ReadOnlyField>
                  <ReadOnlyField label="Receipt issued">{fmt(receipt.issuedAt, tz)}</ReadOnlyField>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No payment record for this booking.</p>
          )}
        </Card>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Call / Attendance</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="Call start">{fmt(b.slot?.startsAt ?? null, tz)}</ReadOnlyField>
            <ReadOnlyField label="Call end">{fmt(b.slot?.endsAt ?? null, tz)}</ReadOnlyField>
            <ReadOnlyField label="Duration">{b.durationMin} min</ReadOnlyField>
            <ReadOnlyField label="Booked on">{fmt(b.createdAt, tz)}</ReadOnlyField>
          </div>
          <p className="mt-3 text-xs text-muted">Times shown in {tz}.</p>
        </Card>

        <p className="mt-4 text-xs text-muted">Payouts, refunds, notification logs and ratings aren&apos;t tracked yet.</p>
      </div>
    </>
  );
}
