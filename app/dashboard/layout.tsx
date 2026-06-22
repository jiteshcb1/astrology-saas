import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";

// Guard: only consultant / team_consulting / team_accounts (live DB role) reach this tree.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRole("access:dashboard");
  return <>{children}</>;
}
