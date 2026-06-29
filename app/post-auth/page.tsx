import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { findActiveMembershipByUser } from "@/lib/tenant-db";
import { provisionSelfServeOrgCore } from "@/lib/self-serve";
import { Card } from "@/components/ui/Card";

// SP-7.1 — the post-login smart router. Both providers (Google + email-OTP) funnel here.
//  • super-admin → /superadmin
//  • already a consultant/team member (LIVE membership, not the stale JWT) → /dashboard
//  • brand-new user (no org) → self-serve provision a solo consultant org on free Starter → /onboarding
export default async function PostAuthPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, email: true },
  });

  if (user?.role === "super_admin") redirect("/superadmin");

  const member = await findActiveMembershipByUser(session.user.id);
  if (member) redirect("/dashboard");

  // No org yet → provision one. The marketing "claim your jyoti.app/<name>" handle rides in as ?claim.
  const { claim } = await searchParams;
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for")?.split(",")[0] ?? hdrs.get("x-real-ip") ?? "").trim() || null;
  const result = await provisionSelfServeOrgCore(session.user.id, {
    claimSlug: claim ?? null,
    ip,
    displayName: user?.name ?? null,
    email: user?.email ?? null,
  });

  if (result.ok) redirect("/onboarding");

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-4">
      <Card className="max-w-md text-center">
        <h1 className="font-display text-xl text-ink">Just a moment</h1>
        <p className="mt-2 text-sm text-muted">
          {result.reason === "rate_limited"
            ? "We're seeing a lot of signups from your network right now. Please try again in a little while."
            : "Something went wrong setting up your account. Please try signing in again shortly."}
        </p>
      </Card>
    </main>
  );
}
