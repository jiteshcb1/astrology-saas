import type { Metadata } from "next";
import { getActiveOrgBySlug } from "@/lib/public-page";
import { PublicBookingPage } from "@/components/public/PublicBookingPage";
import { PublicOffline } from "@/components/public/PublicOffline";
import { getPublicSlotsAction } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getActiveOrgBySlug(slug);
  if (!data) return { title: "Page unavailable" };
  const who = data.profile.displayName || data.orgName;
  return { title: `${who} — Book a consultation`, description: data.profile.bio || undefined };
}

export default async function PublicBookingRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getActiveOrgBySlug(slug);
  if (!data) return <PublicOffline />;

  // Inline server action bound to this slug — the client calls it with (packageId, duration, from, to).
  async function getSlots(packageId: string, durationMin: number, fromISO: string, toISO: string) {
    "use server";
    return getPublicSlotsAction(slug, packageId, durationMin, fromISO, toISO);
  }

  return (
    <PublicBookingPage
      profile={data.profile}
      branding={data.branding}
      packages={data.packages}
      orgName={data.orgName}
      timezone={data.timezone}
      getSlots={getSlots}
    />
  );
}
