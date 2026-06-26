import { requireRole } from "@/lib/rbac";
import { getSubscriptionRevenueTrend } from "@/lib/oversight";
import { chartAriaLabel, monthKeyOf } from "@/lib/month-series";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChartView } from "@/components/ui/charts";

// SP-5.6 — platform revenue (real subscription receipts by month). <2 months with revenue → insufficient.
export async function RevenueTrendChart({ now = new Date() }: { now?: Date }) {
  const { session } = await requireRole("access:superadmin");
  const data = await getSubscriptionRevenueTrend(session.user.id, 12, now);
  const monthsWithRevenue = data.filter((d) => d.value > 0).length;
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg text-ink">Revenue trend</h2>
      {monthsWithRevenue < 2 ? (
        <EmptyState variant="chart_insufficient_data" headline="Revenue trend appears after 2 months of data." />
      ) : (
        <div role="img" aria-label={chartAriaLabel("Platform revenue", data, "inr")}>
          <BarChartView data={data} kind="revenue" currentKey={monthKeyOf(now)} />
        </div>
      )}
    </Card>
  );
}
