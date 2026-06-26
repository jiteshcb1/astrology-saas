import { getEarningsTrend } from "@/lib/consultant-home";
import { getBranding } from "@/lib/branding";
import { resolveBrand } from "@/lib/branding";
import { chartAriaLabel, monthKeyOf } from "@/lib/month-series";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChartView } from "@/components/ui/charts";

// SP-5.6 — consultation earnings by month, in the consultant's primary brand color. Bars link to that month's
// receipts. Shared by the owner home and the Accounts revenue view (org-scoped either way).
export async function EarningsChart({ orgId, heading = "Earnings", now = new Date() }: { orgId: string; heading?: string; now?: Date }) {
  const [data, branding] = await Promise.all([getEarningsTrend(orgId, 6, now), getBranding(orgId)]);
  const { primary } = resolveBrand(branding?.themeColor);
  const hasEarnings = data.some((d) => d.value > 0);
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg text-ink">{heading}</h2>
      {!hasEarnings ? (
        <EmptyState variant="no_earnings_yet" />
      ) : (
        <div role="img" aria-label={chartAriaLabel(heading, data, "inr")}>
          <BarChartView data={data} kind="earnings" color={primary} currentKey={monthKeyOf(now)} hrefBase="/dashboard/receipts?month=" />
        </div>
      )}
    </Card>
  );
}
