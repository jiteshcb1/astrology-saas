import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";
import { resolveFeatures } from "@/lib/flags";
import { FeatureProvider } from "@/components/FeatureProvider";
import { ConsultantSidebar } from "@/components/dashboard/ConsultantSidebar";

// Guard: consultant / team_consulting / team_accounts (live DB role). Renders the consultant app
// shell (left nav + main) and provides the org's resolved feature flags via useFeature().
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session, role } = await requireRole("access:dashboard");
  const features = await resolveFeatures(session.user.orgId);
  return (
    <FeatureProvider features={features}>
      <div className="flex min-h-screen bg-sand">
        <ConsultantSidebar email={session.user.email ?? ""} role={role ?? ""} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </FeatureProvider>
  );
}
