import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { resolveFeatures } from "@/lib/flags";
import { FeatureProvider } from "@/components/FeatureProvider";
import { ConsultantSidebar } from "@/components/dashboard/ConsultantSidebar";
import { CoachProvider } from "@/components/dashboard/coaching/CoachProvider";
import { CoachAutoMount } from "@/components/dashboard/coaching/CoachAutoMount";

// Guard: consultant / team_consulting / team_accounts (live DB role). Renders the consultant app
// shell (left nav + main) and provides the org's resolved feature flags via useFeature().
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, role } = await requireRole("access:dashboard");
  const [features, me] = await Promise.all([
    resolveFeatures(session.user.orgId),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { coachingSeen: true } }),
  ]);
  // SP-7.1 first-run coach marks: seed the per-user "seen" map.
  const cs = me?.coachingSeen;
  const seen = (cs && typeof cs === "object" && !Array.isArray(cs) ? cs : {}) as Record<string, boolean>;
  return (
    <FeatureProvider features={features}>
      <CoachProvider seen={seen}>
        <div className="flex min-h-screen bg-sand">
          <ConsultantSidebar email={session.user.email ?? ""} role={role ?? ""} />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <CoachAutoMount role={role ?? ""} />
      </CoachProvider>
    </FeatureProvider>
  );
}
