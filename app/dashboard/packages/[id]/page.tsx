import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getPackage } from "@/lib/packages";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getBranding } from "@/lib/branding";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PackageForm } from "@/components/dashboard/PackageForm";

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const pkg = orgId ? await getPackage(orgId, id) : null;
  if (!pkg) notFound();

  const [org, branding] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId! }, select: { slug: true } }),
    getBranding(orgId!),
  ]);
  const bookingBase = `${env.AUTH_URL.replace(/\/$/, "")}/${org?.slug ?? ""}`;

  const freq = (pkg.freqLimit ?? {}) as { per_day?: number; per_week?: number; per_month?: number };
  const defaults = {
    id: pkg.id,
    title: pkg.title,
    slug: pkg.slug,
    description: pkg.description ?? "",
    allowedDurations: pkg.allowedDurations,
    defaultDurationMin: pkg.defaultDurationMin,
    allowBookerChooseDuration: pkg.allowBookerChooseDuration,
    priceRupees: String(Math.round(pkg.price / 100)),
    bufferBeforeMin: pkg.bufferBeforeMin,
    bufferAfterMin: pkg.bufferAfterMin,
    minNoticeMin: pkg.minNoticeMin,
    slotIntervalMin: pkg.slotIntervalMin,
    per_day: freq.per_day != null ? String(freq.per_day) : "",
    per_week: freq.per_week != null ? String(freq.per_week) : "",
    per_month: freq.per_month != null ? String(freq.per_month) : "",
  };

  return (
    <>
      <PageHeader title="Edit package" subtitle={pkg.title} />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/dashboard/packages" className="text-sm text-muted hover:text-terra">← Packages</Link>
        <div className="mt-4">
          <PackageForm defaults={defaults} bookingBase={bookingBase} themeColor={branding?.themeColor} />
        </div>
      </div>
    </>
  );
}
