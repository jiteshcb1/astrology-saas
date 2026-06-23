import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";
import { resolveFeatures } from "@/lib/flags";
import { FeatureProvider } from "@/components/FeatureProvider";

// Guard: only consultant / team_consulting / team_accounts (live DB role) reach this tree.
// Resolve the org's feature flags once and provide them to client components via useFeature().
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { session } = await requireRole("access:dashboard");
  const features = await resolveFeatures(session.user.orgId);
  return <FeatureProvider features={features}>{children}</FeatureProvider>;
}
