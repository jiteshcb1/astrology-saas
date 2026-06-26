import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { getDashboardMetrics, getDashboardSignals, getSignupTrend } from "@/lib/admin-dashboard";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { SignupTrendChart } from "@/components/superadmin/SignupTrendChart";
import { DeltaBadge } from "@/components/dashboard/DeltaBadge";

function relative(target: Date | null, now: Date): string {
  if (!target) return "—";
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const day = 86_400_000;
  const hr = 3_600_000;
  const unit = (n: number, u: string) => `${n} ${u}${n === 1 ? "" : "s"}`;
  const s = abs >= day ? unit(Math.round(abs / day), "day") : abs >= hr ? unit(Math.round(abs / hr), "hour") : unit(Math.max(1, Math.round(abs / 60_000)), "minute");
  return ms >= 0 ? `in ${s}` : `${s} ago`;
}

// ── Stat cards ────────────────────────────────────────────────────────────────
export async function StatCardSection() {
  const m = await getDashboardMetrics();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Consultants" value={String(m.totalConsultants)} hint="Total organizations" filled footer={<DeltaBadge delta={m.consultantsDelta} />} />
      <MetricCard label="Active subscriptions" value={String(m.activeSubscriptions)} hint="Currently billing" footer={<DeltaBadge delta={m.activeSubsDelta} />} />
      <MetricCard label="MRR" value={`${formatMoney(m.mrrPaise)}/mo`} hint="Monthly, normalized" />
      <MetricCard label="Suspended" value={String(m.suspendedOrgs)} hint="Offline booking pages" accent={m.suspendedOrgs > 0} />
    </div>
  );
}

// ── Signals ───────────────────────────────────────────────────────────────────
interface Row {
  id: string;
  name: string;
  meta: string;
  badge?: { label: string; tone: "danger" | "warning" };
}
function SignalCard({ title, rows, hasMore }: { title: string; rows: Row[]; hasMore: boolean }) {
  if (rows.length === 0) return null; // invisible when empty (no empty boxes)
  return (
    <Card>
      <h2 className="mb-1 font-display text-lg text-ink">{title}</h2>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <Link href={`/superadmin/consultants/${r.id}`} className="truncate font-medium text-ink hover:text-terra">{r.name}</Link>
            <span className="flex shrink-0 items-center gap-2 text-muted">
              {r.badge ? <StatusChip label={r.badge.label} tone={r.badge.tone} /> : null}
              {r.meta}
            </span>
          </li>
        ))}
      </ul>
      {hasMore ? <Link href="/superadmin/consultants" className="mt-2 inline-block text-sm text-terra hover:underline">View all →</Link> : null}
    </Card>
  );
}

export async function SignalSection() {
  const now = new Date();
  const s = await getDashboardSignals(now);

  const signups = (
    <SignalCard
      title="Recent signups"
      hasMore={s.recentSignups.hasMore}
      rows={s.recentSignups.items.map((o) => ({ id: o.orgId, name: o.orgName, meta: `${o.planName ?? "no plan"} · ${relative(o.createdAt, now)}` }))}
    />
  );

  if (s.allClear) {
    return (
      <div className="space-y-4">
        <Card className="border-l-4 border-l-marigold">
          <div className="flex items-center gap-4">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden>
              <path d="M6 34l10-10 7 7 13-15" stroke="#4f9d69" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 16h6v6" stroke="#4f9d69" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="38" cy="14" r="6" fill="#e8a33d" />
              <path d="M35.5 14l1.8 1.8 3.2-3.4" stroke="#14122b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <h2 className="font-display text-lg text-ink">Everything looks healthy.</h2>
              <p className="text-sm text-muted">No consultants in grace, suspension, or nearing renewal. Your platform is running smoothly.</p>
            </div>
          </div>
        </Card>
        {signups}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SignalCard
          title="Nearing renewal"
          hasMore={s.nearingRenewal.hasMore}
          rows={s.nearingRenewal.items.map((r) => ({ id: r.orgId, name: r.orgName, meta: `${r.planName} · ${formatMoney(r.amountPaise)} · ${relative(r.currentPeriodEnd, now)}` }))}
        />
        <SignalCard
          title="Past due / in grace"
          hasMore={s.pastDue.hasMore}
          rows={s.pastDue.items.map((r) => ({ id: r.orgId, name: r.orgName, meta: `${formatMoney(r.amountPaise)} · ${relative(r.pastDueSince, now)}`, badge: { label: "Past due", tone: "danger" } }))}
        />
        <SignalCard
          title="Recently suspended"
          hasMore={s.recentlySuspended.hasMore}
          rows={s.recentlySuspended.items.map((r) => ({ id: r.orgId, name: r.orgName, meta: `${r.reason ?? "suspended"} · ${relative(r.suspendedAt, now)}` }))}
        />
        <SignalCard
          title="Over seat limit"
          hasMore={s.overSeatLimit.hasMore}
          rows={s.overSeatLimit.items.map((r) => ({ id: r.orgId, name: r.orgName, meta: `${r.seatCount} seats · plan covers ${r.purchasedSeats}`, badge: { label: "Seat limit", tone: "warning" } }))}
        />
      </div>
      {signups}
    </div>
  );
}

// ── Real signup trend chart (kept; SP-5.5 keeps existing charts) ────────────────
export async function SignupTrendSection() {
  const trend = await getSignupTrend();
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg text-ink">Consultants created (last 6 months)</h2>
      <SignupTrendChart data={trend} />
    </Card>
  );
}
