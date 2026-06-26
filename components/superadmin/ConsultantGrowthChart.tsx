import { getOrgGrowthTrend } from "@/lib/admin-dashboard";
import { chartAriaLabel } from "@/lib/month-series";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaChartView } from "@/components/ui/charts";

// SP-5.6 — cumulative consultant growth (real org counts by month). <2 months of history → insufficient.
export async function ConsultantGrowthChart({ now = new Date() }: { now?: Date }) {
  const data = await getOrgGrowthTrend(12, now);
  const monthsWithConsultants = data.filter((d) => d.value > 0).length;
  return (
    <Card>
      <h2 className="mb-4 font-display text-lg text-ink">Consultant growth</h2>
      {monthsWithConsultants < 2 ? (
        <EmptyState variant="chart_insufficient_data" headline="Your growth trend appears after 2 months of data." />
      ) : (
        <div role="img" aria-label={chartAriaLabel("Total consultants", data, "count")}>
          <AreaChartView data={data} />
        </div>
      )}
    </Card>
  );
}
