import type { Metadata } from "next";
import { getConsultantLegal } from "@/lib/legal";
import { LegalDocView } from "@/components/public/LegalDocView";
import { PublicOffline } from "@/components/public/PublicOffline";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getConsultantLegal(slug, "privacy");
  return { title: view ? `Privacy Policy — ${view.consultantName}` : "Privacy Policy" };
}

export default async function ConsultantPrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getConsultantLegal(slug, "privacy");
  if (!view) return <PublicOffline />;
  return (
    <LegalDocView
      view={{ title: view.title, html: view.html, updatedAtISO: view.updatedAtISO, brandName: view.consultantName, themeColor: view.themeColor, logoUrl: view.logoUrl, backHref: `/${view.slug}`, backLabel: view.consultantName }}
    />
  );
}
