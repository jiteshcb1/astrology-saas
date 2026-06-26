import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { StatCardSection, SignalSection } from "@/components/superadmin/DashboardSections";
import { ConsultantGrowthChart } from "@/components/superadmin/ConsultantGrowthChart";
import { RevenueTrendChart } from "@/components/superadmin/RevenueTrendChart";
import { StatCardSkeletonRow, SectionSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

function ChartFallback({ height = 200 }: { height?: number }) {
  return (
    <Card>
      <div aria-hidden className="shimmer mb-4 h-5 w-36 rounded" />
      <ChartSkeleton height={height} />
    </Card>
  );
}

export default async function SuperadminDashboard() {
  // SP-5.5: each section streams under its own Suspense boundary with a matching CSS skeleton. All numbers
  // come from named DB queries (lib/admin-dashboard); empty signal lists are invisible (no empty boxes).
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
        <Suspense fallback={<StatCardSkeletonRow />}>
          <StatCardSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <SignalSection />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<ChartFallback />}>
            <ConsultantGrowthChart />
          </Suspense>
          <Suspense fallback={<ChartFallback />}>
            <RevenueTrendChart />
          </Suspense>
        </div>
      </div>
    </>
  );
}
