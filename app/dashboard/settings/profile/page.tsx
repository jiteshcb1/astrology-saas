import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { listPackages } from "@/lib/packages";
import { getBranding } from "@/lib/branding";
import { getSignedUrl } from "@/lib/storage";
import { isAiConfigured } from "@/lib/gemini";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { LandingPreviewWorkspace } from "@/components/dashboard/LandingPreviewWorkspace";

export default async function ProfileSettingsPage() {
  const { role, orgId } = await requireSection("settings");
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const [packages, branding] = await Promise.all([
    orgId ? listPackages(orgId) : Promise.resolve([]),
    orgId ? getBranding(orgId) : Promise.resolve(null),
  ]);
  const logoUrl = branding?.logoKey ? await getSignedUrl(branding.logoKey) : null;
  const social = (profile?.socialLinks ?? {}) as Record<string, string>;

  const defaults = {
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    experience: profile?.experience ?? "",
    specialities: profile?.specialities ?? [],
    website: social.website ?? "",
    instagram: social.instagram ?? "",
    youtube: social.youtube ?? "",
    x: social.x ?? "",
    gstNumber: profile?.gstNumber ?? "",
    gstLegalName: profile?.gstLegalName ?? "",
    complaintsContactNumber: profile?.complaintsContactNumber ?? "",
  };

  // Same data the packages page feeds the preview workspace.
  const wsProfile = {
    displayName: defaults.displayName,
    bio: defaults.bio,
    experience: defaults.experience,
    specialities: defaults.specialities,
    complaintsContactNumber: defaults.complaintsContactNumber,
    website: defaults.website,
    instagram: defaults.instagram,
    youtube: defaults.youtube,
    x: defaults.x,
    gstNumber: defaults.gstNumber,
    gstLegalName: defaults.gstLegalName,
  };
  const wsPackages = packages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description ?? "",
    priceRupees: String(Math.round(p.price / 100)),
    allowedDurations: p.allowedDurations,
    defaultDurationMin: p.defaultDurationMin,
    allowBookerChooseDuration: p.allowBookerChooseDuration,
    bufferBeforeMin: p.bufferBeforeMin,
    bufferAfterMin: p.bufferAfterMin,
    minNoticeMin: p.minNoticeMin,
    slotIntervalMin: p.slotIntervalMin,
    freqLimit: (p.freqLimit ?? {}) as { per_day?: number; per_week?: number; per_month?: number },
    isActive: p.isActive,
  }));

  return (
    <>
      <PageHeader title="Profile" subtitle="What seekers see on your public booking page">
        <LandingPreviewWorkspace
          profile={wsProfile}
          branding={{ themeColor: branding?.themeColor ?? null, logoUrl }}
          packages={wsPackages}
        />
      </PageHeader>
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-terra">
          ← Settings
        </Link>
        <div className="mt-4">
          <ProfileForm defaults={defaults} aiEnabled={isAiConfigured()} />
        </div>
      </div>
    </>
  );
}
