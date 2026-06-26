import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { StatCardSection, SignalSection, SignupTrendSection } from "@/components/superadmin/DashboardSections";
import { StatCardSkeletonRow, SectionSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

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
          <Suspense fallback={<Card><ChartSkeleton height={180} /></Card>}>
            <SignupTrendSection />
          </Suspense>
          {/* SP-5.6 chart slot — honest placeholder. */}
          <Card>
            <h2 className="mb-4 font-display text-lg text-ink">Revenue trend</h2>
            <ChartSkeleton height={180} label="Revenue trend — coming in next update" />
          </Card>
        </div>
      </div>
    </>
  );
}
