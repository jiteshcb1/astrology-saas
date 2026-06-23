import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { CatalogForm } from "../CatalogForm";
import { updateCatalogAction } from "../actions";

export default async function CatalogItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) notFound();

  const value = (item.value ?? {}) as Record<string, unknown>;
  const defaults = {
    type: item.type,
    key: item.key,
    label: item.label,
    sortOrder: item.sortOrder,
    hex: typeof value.hex === "string" ? value.hex : undefined,
    script: typeof value.script === "string" ? value.script : undefined,
    fontFamily: typeof value.fontFamily === "string" ? value.fontFamily : undefined,
  };

  return (
    <>
      <PageHeader title={item.label} />
      <div className="mx-auto w-full max-w-xl px-6 py-8 md:px-8">
        <div className="mb-4">
          <Link href="/superadmin/catalogs" className="text-sm text-muted hover:text-terra">
            ← Catalogs
          </Link>
          <p className="mt-1 text-sm text-muted">
            {item.type} · {item.key}
          </p>
        </div>
        <Card>
          <CatalogForm action={updateCatalogAction} id={item.id} defaults={defaults} submitLabel="Save" />
        </Card>
      </div>
    </>
  );
}
