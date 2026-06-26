import Link from "next/link";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getOwnerStatCards, getOwnerUpcoming, getOwnerChecklist } from "@/lib/consultant-home";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { ShareLinkButton } from "@/components/dashboard/ShareLinkButton";

const TZ = "Asia/Kolkata";
const BASE = env.AUTH_URL.replace(/\/$/, "");
const publicUrl = (slug: string) => `${BASE}/${slug}`;

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }).format(d);
}
function statusTone(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "confirmed") return "success";
  if (s === "pending_verification") return "warning";
  if (s === "cancelled") return "danger";
  return "neutral";
}

function EarningsDelta({ thisP, lastP }: { thisP: number; lastP: number }) {
  if (thisP === 0 && lastP === 0) return null;
  const diff = thisP - lastP;
  if (diff === 0) return <span className="text-xs text-muted">No change vs last month</span>;
  const up = diff > 0;
  return <span className={`text-xs font-medium ${up ? "text-green" : "text-terra"}`}>{up ? "↑" : "↓"} {formatMoney(Math.abs(diff))} vs last month</span>;
}

export async function OwnerStatCards({ orgId }: { orgId: string }) {
  const now = new Date();
  const s = await getOwnerStatCards(orgId, now);
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: TZ }).format(now);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total bookings" value={String(s.totalBookings)} hint="All time" />
      <MetricCard label="Earnings this month" value={formatMoney(s.earningsThisMonthPaise)} hint={`Confirmed payments, ${monthLabel}`} footer={<EarningsDelta thisP={s.earningsThisMonthPaise} lastP={s.earningsLastMonthPaise} />} />
      <MetricCard label="Upcoming sessions" value={String(s.upcomingCount)} hint={s.nextStartsAt ? `Next: ${fmtDateTime(s.nextStartsAt)}` : "None scheduled"} />
      <MetricCard label="Average rating" value="—" hint="No reviews yet" />
    </div>
  );
}

export async function OwnerUpcoming({ orgId, slug }: { orgId: string; slug: string }) {
  const { hasTeam, rows } = await getOwnerUpcoming(orgId);
  return (
    <Card>
      <h2 className="mb-3 font-display text-lg text-ink">Upcoming consultations</h2>
      {rows.length === 0 ? (
        <EmptyState variant="no_upcoming_sessions" cta={<ShareLinkButton url={publicUrl(slug)} />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Seeker</th>
                <th className="py-2 pr-3 font-medium">Package</th>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                {hasTeam && <th className="py-2 pr-3 font-medium">Host</th>}
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 text-ink">{r.seekerName || "Seeker"}</td>
                  <td className="py-2.5 pr-3 text-muted">{r.packageTitle}</td>
                  <td className="py-2.5 pr-3 text-muted">{fmtDateTime(r.startsAt)}</td>
                  <td className="py-2.5 pr-3 text-muted">{r.durationMin} min</td>
                  {hasTeam && <td className="py-2.5 pr-3 text-muted">{r.hostName ?? "—"}</td>}
                  <td className="py-2.5"><StatusChip label={r.status.replace(/_/g, " ")} tone={statusTone(r.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export async function OwnerChecklist({ orgId, slug }: { orgId: string; slug: string }) {
  const { items, doneCount, total, allDone } = await getOwnerChecklist(orgId);
  if (allDone) {
    return (
      <Card className="border-l-4 border-l-marigold">
        <EmptyState
          variant="consultant_all_done"
          cta={
            <Link href={`/${slug}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-terra hover:underline">
              View your public page →
            </Link>
          }
        />
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="mb-1 font-display text-lg text-ink">Finish your setup</h2>
      <div className="mb-2 text-sm text-muted">{doneCount} / {total} complete</div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-sand-2">
        <div className="h-full rounded-full bg-marigold transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${it.done ? "border-green bg-green/15 text-green" : "border-marigold text-marigold"}`}>
              {it.done ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </span>
            <span className={`flex-1 text-sm ${it.done ? "text-muted line-through" : "text-ink"}`}>{it.label}</span>
            {it.done ? null : it.href ? (
              <Link href={it.href} className="shrink-0 text-sm text-terra hover:underline">{it.cta} →</Link>
            ) : (
              <ShareLinkButton url={publicUrl(slug)} label={it.cta} className="shrink-0 text-sm font-medium text-terra hover:underline" />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
