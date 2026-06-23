import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";

export default async function SettingsPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile, branding and payments" />
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/settings/profile">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Profile</h2>
              <p className="mt-1 text-sm text-muted">Bio, specialities, social links, GST &amp; contact.</p>
            </Card>
          </Link>
          <Link href="/dashboard/settings/branding">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Branding</h2>
              <p className="mt-1 text-sm text-muted">Logo, theme colour, font &amp; default language.</p>
            </Card>
          </Link>
          <Link href="/dashboard/settings/payments">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Payments</h2>
              <p className="mt-1 text-sm text-muted">UPI QR or your own gateway keys.</p>
            </Card>
          </Link>
        </div>
      </div>
    </>
  );
}
