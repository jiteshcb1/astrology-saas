import { requireRole } from "@/lib/rbac";
import { listPlatformLegal, PLATFORM_DOC_TYPES, type PlatformDocType } from "@/lib/platform-legal";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PlatformLegalForm, type PlatformDocDefault } from "@/components/superadmin/PlatformLegalForm";

export default async function SuperadminLegalPage() {
  await requireRole("access:superadmin");
  const rows = await listPlatformLegal();
  const byType = new Map(rows.map((r) => [r.docType, r]));

  const docs: PlatformDocDefault[] = PLATFORM_DOC_TYPES.map((docType) => {
    const row = byType.get(docType);
    return {
      docType: docType as PlatformDocType,
      html: row?.contentHtml ?? "",
      updatedAtISO: row ? row.updatedAt.toISOString() : null,
    };
  });

  return (
    <>
      <PageHeader title="Legal" subtitle="Platform-wide policies shown to all users" />
      <div className="mx-auto w-full max-w-2xl px-6 py-6">
        <PlatformLegalForm docs={docs} />
      </div>
    </>
  );
}
