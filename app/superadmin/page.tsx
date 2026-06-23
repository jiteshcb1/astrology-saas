import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { SignupTrendChart } from "@/components/superadmin/SignupTrendChart";
import { getDashboardMetrics, getDashboardSignals, getSignupTrend } from "@/lib/admin-dashboard";

function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

interface SignalRow {
  id: string;
  name: string;
  meta: string;
}

function SignalCard({ title, items, empty }: { title: string; items: SignalRow[]; empty: string }) {
  return (
    <Card>
      <h2 className="mb-1 font-display text-lg text-ink">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link href={`/superadmin/consultants/${it.id}`} className="truncate font-medium text-ink hover:text-terra">
                {it.name}
              </Link>
              <span className="shrink-0 text-muted">{it.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function SuperadminDashboard() {
  const [metrics, signals, trend] = await Promise.all([
    getDashboardMetrics(),
    getDashboardSignals(),
    getSignupTrend(),
  ]);

  const fmtDate = (d: Date) => d.toLocaleDateString("en-IN");

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Consultants" value={String(metrics.totalConsultants)} />
          <MetricCard label="Active subscriptions" value={String(metrics.activeSubscriptions)} />
          <MetricCard label="MRR" value={rupees(metrics.mrrPaise)} hint="Monthly, normalized" />
          <MetricCard label="Suspended" value={String(metrics.suspendedOrgs)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SignalCard
            title="Nearing renewal"
            empty="No renewals in the next 7 days."
            items={signals.nearingRenewal.map((s) => ({
              id: s.organization.id,
              name: s.organization.name,
              meta: s.currentPeriodEnd ? `renews ${fmtDate(s.currentPeriodEnd)}` : "—",
            }))}
          />
          <SignalCard
            title="Past due / in grace"
            empty="No past-due subscriptions."
            items={signals.pastDue.map((s) => ({ id: s.organization.id, name: s.organization.name, meta: "past due" }))}
          />
          <SignalCard
            title="Recently suspended"
            empty="No suspended consultants."
            items={signals.recentlySuspended.map((o) => ({ id: o.id, name: o.name, meta: fmtDate(o.updatedAt) }))}
          />
          <SignalCard
            title="Recent signups"
            empty="No consultants yet."
            items={signals.recentSignups.map((o) => ({ id: o.id, name: o.name, meta: fmtDate(o.createdAt) }))}
          />
        </div>

        <Card className="mt-6">
          <h2 className="mb-4 font-display text-lg text-ink">Consultants created (last 6 months)</h2>
          <SignupTrendChart data={trend} />
        </Card>
      </div>
    </>
  );
}
