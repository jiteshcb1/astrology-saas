import Link from "next/link";
import { getPlatformLegal, PLATFORM_DOC_LABELS, type PlatformDocType } from "@/lib/platform-legal";
import { LegalDocView } from "@/components/public/LegalDocView";

// Renders a platform-level legal doc (super-admin authored). Empty → a "not published yet" notice.
export async function PlatformLegalView({ docType }: { docType: PlatformDocType }) {
  const row = await getPlatformLegal(docType);
  const title = PLATFORM_DOC_LABELS[docType];
  const hasContent = Boolean(row && row.contentHtml.replace(/<[^>]*>/g, "").trim());

  if (!hasContent) {
    return (
      <div className="grid min-h-screen place-items-center bg-sand px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">This document hasn&apos;t been published yet.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-terra underline">← Home</Link>
        </div>
      </div>
    );
  }

  return (
    <LegalDocView
      view={{ title, html: row!.contentHtml, updatedAtISO: row!.updatedAt.toISOString(), brandName: "Astro Consultancy", themeColor: null, logoUrl: null, backHref: "/", backLabel: "Home" }}
    />
  );
}
