import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getBranding } from "@/lib/branding";
import { isAiConfigured } from "@/lib/gemini";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PackageForm } from "@/components/dashboard/PackageForm";

export default async function NewPackagePage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const [org, branding] = await Promise.all([
    orgId ? prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } }) : Promise.resolve(null),
    orgId ? getBranding(orgId) : Promise.resolve(null),
  ]);
  const bookingBase = `${env.AUTH_URL.replace(/\/$/, "")}/${org?.slug ?? ""}`;

  const defaults = {
    title: "",
    slug: "",
    description: "",
    allowedDurations: [30],
    defaultDurationMin: 30,
    allowBookerChooseDuration: false,
    priceRupees: "",
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 0,
    slotIntervalMin: 15,
    per_day: "",
    per_week: "",
    per_month: "",
    questions: [],
  };

  return (
    <>
      <PageHeader title="New package" subtitle="A bookable consultation type" />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/dashboard/packages" className="text-sm text-muted hover:text-terra">← Packages</Link>
        <div className="mt-4">
          <PackageForm defaults={defaults} bookingBase={bookingBase} themeColor={branding?.themeColor} aiEnabled={isAiConfigured()} />
        </div>
      </div>
    </>
  );
}
