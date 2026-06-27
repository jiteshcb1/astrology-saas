import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Card } from "@/components/ui/Card";
import { getProfile } from "@/lib/consultant-profile";
import { findActiveMembershipByUser } from "@/lib/tenant-db";
import { getCalendarIntegration, toSafeView } from "@/lib/calendar";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";

// Focused, full-screen onboarding (outside the dashboard shell). Guarded to the consultant app.
export default async function OnboardingPage() {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;

  if (!orgId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-4">
        <Card className="max-w-md text-center">
          <h1 className="font-display text-xl text-ink">No organization linked</h1>
          <p className="mt-2 text-sm text-muted">Your account isn&apos;t linked to a consultant org yet. Contact the operator.</p>
        </Card>
      </main>
    );
  }

  const [org, profile, member] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true, name: true } }),
    getProfile(orgId),
    findActiveMembershipByUser(session.user.id),
  ]);
  if (profile?.onboardedAt) redirect("/dashboard");
  // Reflect the per-member calendar connection (Step 2) — same membership the OAuth flow connects.
  const calView = member ? toSafeView(await getCalendarIntegration(member.organizationId, member.id)) : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-sand px-4 py-12">
      <div className="mb-6 flex items-center gap-2 font-logo text-2xl text-ink">
        <span className="text-marigold">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
          </svg>
        </span>
        Jyoti
      </div>
      <div className="w-full max-w-xl">
        <h1 className="font-display text-2xl text-ink">Let&apos;s get you set up</h1>
        <p className="mb-5 text-sm text-muted">A couple of details and you&apos;re ready to take bookings.</p>
        <Card>
          <OnboardingWizard
            bookingBase={env.AUTH_URL}
            slug={org?.slug ?? ""}
            defaults={{
              displayName: profile?.displayName ?? org?.name ?? "",
              businessType: profile?.businessType ?? undefined,
              timezone: profile?.timezone ?? undefined,
            }}
            calendarConnected={Boolean(calView?.connected)}
            calendarEmail={calView?.googleEmail ?? null}
          />
        </Card>
      </div>
    </main>
  );
}
