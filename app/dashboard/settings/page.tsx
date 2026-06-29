import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { replayToursAction } from "@/components/dashboard/coaching/actions";

export default async function SettingsPage() {
  const { role, orgId } = await requireSection("settings");
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
          <Link href="/dashboard/settings/calendar">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Calendar</h2>
              <p className="mt-1 text-sm text-muted">Connect Google Calendar — auto-block busy time &amp; add Meet links.</p>
            </Card>
          </Link>
          <Link href="/dashboard/settings/legal">
            <Card className="h-full transition hover:border-marigold">
              <h2 className="font-display text-lg text-ink">Legal</h2>
              <p className="mt-1 text-sm text-muted">Privacy policy &amp; terms shown on your booking page.</p>
            </Card>
          </Link>
        </div>

        {/* SP-7.1 — replay the first-run guided coach marks. */}
        <form action={replayToursAction} className="mt-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-ink">Product tour</h2>
              <p className="mt-1 text-sm text-muted">New here, or want a refresher? Replay the guided coach marks across your dashboard.</p>
            </div>
            <button type="submit" className="shrink-0 rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-marigold">Replay product tour</button>
          </Card>
        </form>
      </div>
    </>
  );
}
