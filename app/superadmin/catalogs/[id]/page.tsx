import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
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
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/catalogs" className="text-sm text-muted hover:text-terra">
          ← Catalogs
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">{item.label}</h1>
        <p className="text-sm text-muted">
          {item.type} · {item.key}
        </p>
      </div>
      <Card>
        <CatalogForm action={updateCatalogAction} id={item.id} defaults={defaults} submitLabel="Save" />
      </Card>
    </main>
  );
}
