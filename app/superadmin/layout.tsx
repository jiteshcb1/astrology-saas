import type { ReactNode } from "react";
import { requireRole } from "@/lib/rbac";
import { SuperadminSidebar } from "@/components/superadmin/SuperadminSidebar";

// Guard: only super_admin (authorized against the live DB role) reaches this tree.
// Renders the persistent app shell (left nav + main column); pages provide their own PageHeader.
export default async function SuperadminLayout({ children }: { children: ReactNode }) {
  const { session, role } = await requireRole("access:superadmin");
  return (
    <div className="flex min-h-screen bg-sand">
      <SuperadminSidebar email={session.user.email ?? ""} role={role ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
