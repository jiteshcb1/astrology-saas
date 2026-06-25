import type { Metadata } from "next";
import { getConsultantLegal } from "@/lib/legal";
import { LegalDocView } from "@/components/public/LegalDocView";
import { PublicOffline } from "@/components/public/PublicOffline";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getConsultantLegal(slug, "terms");
  return { title: view ? `Terms & Conditions — ${view.consultantName}` : "Terms & Conditions" };
}

export default async function ConsultantTermsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const view = await getConsultantLegal(slug, "terms");
  if (!view) return <PublicOffline />;
  return (
    <LegalDocView
      view={{ title: view.title, html: view.html, updatedAtISO: view.updatedAtISO, brandName: view.consultantName, themeColor: view.themeColor, logoUrl: view.logoUrl, backHref: `/${view.slug}`, backLabel: view.consultantName }}
    />
  );
}
