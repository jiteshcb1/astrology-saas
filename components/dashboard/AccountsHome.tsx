import { Suspense } from "react";
import { getRevenueSummary, getMonthlyRevenue, getRevenueByPackage } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/superadmin/MetricCard";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { StatCardSkeletonRow, TableSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

async function AccountsStatCards({ orgId }: { orgId: string }) {
  const summary = await getRevenueSummary(orgId, new Date());
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total revenue" value={formatMoney(summary.totalPaise)} filled />
      <MetricCard label="This month" value={formatMoney(summary.thisMonthPaise)} />
      <MetricCard label="Last month" value={formatMoney(summary.lastMonthPaise)} />
      <MetricCard label="Pending verification" value={String(summary.pendingVerificationCount)} hint="UPI proofs awaiting" accent={summary.pendingVerificationCount > 0} />
    </div>
  );
}

async function AccountsRevenue({ orgId }: { orgId: string }) {
  const [monthly, byPackage] = await Promise.all([getMonthlyRevenue(orgId, new Date(), 6), getRevenueByPackage(orgId)]);
  return (
    <>
      <Card className="mt-6">
        <h2 className="mb-4 font-display text-lg text-ink">Revenue — last 6 months</h2>
        <MonthlyBarChart data={monthly} />
      </Card>

      <Card className="mt-6 p-0">
        <h2 className="px-6 pb-2 pt-6 font-display text-lg text-ink">Revenue by package</h2>
        {byPackage.length === 0 ? (
          <EmptyState variant="no_earnings_yet" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-y border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-2.5 font-medium">Package</th>
                <th className="px-6 py-2.5 font-medium">Bookings</th>
                <th className="px-6 py-2.5 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {byPackage.map((p) => (
                <tr key={p.title} className="border-b border-line last:border-0">
                  <td className="px-6 py-3 text-ink">{p.title}</td>
                  <td className="px-6 py-3 text-muted">{p.count}</td>
                  <td className="px-6 py-3 text-right font-medium text-ink">{formatMoney(p.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

export function AccountsHome({ orgId }: { orgId: string }) {
  return (
    <>
      <PageHeader title="Revenue" subtitle="Financial overview for your organization" />
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <Suspense fallback={<StatCardSkeletonRow />}>
          <AccountsStatCards orgId={orgId} />
        </Suspense>
        <Suspense fallback={<div className="mt-6 space-y-6"><Card><ChartSkeleton height={180} /></Card><TableSkeleton /></div>}>
          <AccountsRevenue orgId={orgId} />
        </Suspense>
      </div>
    </>
  );
}
