import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getActiveCatalog } from "@/lib/catalog";
import { getBranding } from "@/lib/branding";
import { getSignedUrl } from "@/lib/storage";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { BrandingForm, type ColorOption, type FontOption } from "@/components/dashboard/BrandingForm";

export default async function BrandingSettingsPage() {
  const { session, role } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  const profile = orgId ? await getProfile(orgId) : null;
  if (role === "consultant" && (!orgId || !profile?.onboardedAt)) redirect("/onboarding");

  const [colorItems, fontItems, branding] = await Promise.all([
    getActiveCatalog("theme_color"),
    getActiveCatalog("font"),
    orgId ? getBranding(orgId) : Promise.resolve(null),
  ]);

  const colors: ColorOption[] = colorItems
    .map((c) => ({ key: c.key, label: c.label, hex: (c.value as { hex?: string }).hex ?? "" }))
    .filter((c) => c.hex);
  const fonts: FontOption[] = fontItems.map((f) => ({
    key: f.key,
    label: f.label,
    fontFamily: (f.value as { fontFamily?: string }).fontFamily ?? f.label,
  }));

  // Resolve the stored logo key to a (signed/stub) URL for display.
  const logoUrl = branding?.logoKey ? await getSignedUrl(branding.logoKey) : null;

  const defaults = {
    displayName: profile?.displayName ?? "",
    logoUrl,
    themeColor: branding?.themeColor ?? "",
    fontKey: branding?.fontKey ?? "",
    defaultLocale: branding?.defaultLocale ?? "en",
  };

  return (
    <>
      <PageHeader title="Branding" subtitle="Personalize your public booking page" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-terra">
          ← Settings
        </Link>
        <div className="mt-4">
          <BrandingForm defaults={defaults} colors={colors} fonts={fonts} />
        </div>
      </div>
    </>
  );
}
