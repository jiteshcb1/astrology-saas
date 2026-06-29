import type { Metadata } from "next";
import { getActiveOrgBySlug } from "@/lib/public-page";
import { PublicProfile } from "@/components/public/PublicProfile";
import { PublicOffline } from "@/components/public/PublicOffline";
import { getPublicSlotsAction } from "../actions";
import { holdSlotAction } from "../book/actions";

// SP-7.1 — per-package deep link: /<slug>/<packageSlug> renders the consultant's public page with the
// matching package's booking side-panel already open. Static siblings (book/invite/privacy/terms) win over
// this dynamic segment, so only real package slugs land here. Unknown package slug → page renders, no drawer.
export async function generateMetadata({ params }: { params: Promise<{ slug: string; packageSlug: string }> }): Promise<Metadata> {
  const { slug, packageSlug } = await params;
  const data = await getActiveOrgBySlug(slug);
  if (!data) return { title: "Page unavailable" };
  const who = data.profile.displayName || data.orgName;
  const pkg = data.packages.find((p) => p.slug === packageSlug);
  return {
    title: pkg ? `${pkg.title} — ${who}` : `${who} — Book a consultation`,
    description: data.profile.bio || undefined,
  };
}

export default async function PublicPackageRoute({ params }: { params: Promise<{ slug: string; packageSlug: string }> }) {
  const { slug, packageSlug } = await params;
  const data = await getActiveOrgBySlug(slug);
  if (!data) return <PublicOffline />;

  // Inline server actions bound to this slug — identical to the /<slug> route.
  async function getSlots(packageId: string, durationMin: number, fromISO: string, toISO: string) {
    "use server";
    return getPublicSlotsAction(slug, packageId, durationMin, fromISO, toISO);
  }
  async function onContinue(packageId: string, durationMin: number, startISO: string) {
    "use server";
    return holdSlotAction(slug, packageId, durationMin, startISO);
  }

  return (
    <PublicProfile
      profile={data.profile}
      branding={data.branding}
      packages={data.packages}
      orgName={data.orgName}
      slug={slug}
      timezone={data.timezone}
      confirmedCount={data.confirmedCount}
      legal={data.legal}
      getSlots={getSlots}
      onContinue={onContinue}
      initialPackageSlug={packageSlug}
    />
  );
}
