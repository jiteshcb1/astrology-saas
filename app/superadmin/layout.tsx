import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";

// Guard: only super_admin (authorized against the live DB role) reaches this tree.
export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  await requireRole("access:superadmin");
  return <>{children}</>;
}
