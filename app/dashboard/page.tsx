import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSection, dashboardHomeKind } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { isDashboardDemo } from "@/lib/demo-data";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { ConsultingHome } from "@/components/dashboard/ConsultingHome";
import { AccountsHome } from "@/components/dashboard/AccountsHome";
import { DemoDashboard } from "@/components/dashboard/DemoDashboard";
import { OwnerStatCards, OwnerUpcoming, OwnerChecklist } from "@/components/dashboard/OwnerHome";
import { StatCardSkeletonRow, TableSkeleton, ChecklistSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

export default async function DashboardHome() {
  const { role, orgId, memberId } = await requireSection("home");
  // SP-5.3: team members get their own role-scoped home; the owner keeps the full dashboard.
  const kind = dashboardHomeKind(role);
  if (kind === "consulting") return <ConsultingHome orgId={orgId} memberId={memberId} />;
  if (kind === "accounts") return <AccountsHome orgId={orgId} />;

  const [profile, org] = await Promise.all([getProfile(orgId), prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } })]);
  if (!profile?.onboardedAt) redirect("/onboarding");
  const slug = org?.slug ?? "";

  if (isDashboardDemo()) return <DemoDashboard orgId={orgId} />;

  // SP-5.5: every number is real (or a designed empty state). Each section streams under its own Suspense
  // boundary with a CSS shimmer skeleton that matches the real layout (zero layout shift).
  return (
    <>
      <PageHeader title="Home" subtitle="Your central hub for scheduling and consultations" />
      <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
        <Suspense fallback={<StatCardSkeletonRow />}>
          <OwnerStatCards orgId={orgId} />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Suspense fallback={<Card><div aria-hidden className="shimmer mb-3 h-5 w-48 rounded" /><TableSkeleton /></Card>}>
            <OwnerUpcoming orgId={orgId} slug={slug} />
          </Suspense>
          <Suspense fallback={<Card><ChecklistSkeleton /></Card>}>
            <OwnerChecklist orgId={orgId} slug={slug} />
          </Suspense>
        </div>

        {/* SP-5.6 chart slots — honest placeholders (no broken blank space). */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Earnings trend</h2>
            <ChartSkeleton height={180} label="Earnings trend — coming in next update" />
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Bookings over time</h2>
            <ChartSkeleton height={180} label="Bookings chart — coming in next update" />
          </Card>
        </div>
      </div>
    </>
  );
}
