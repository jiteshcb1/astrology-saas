import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";

export default async function SuperadminSettingsPage() {
  await requireRole("access:superadmin");
  return (
    <>
      <PageHeader title="Settings" subtitle="Platform operational controls" />
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/superadmin/settings/email-notifications">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Email Notification Management</h2>
              <p className="mt-1 text-sm text-muted">Pause outbound email globally or per notification type.</p>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}
