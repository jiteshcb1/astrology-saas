import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CatalogForm } from "../CatalogForm";
import { createCatalogAction } from "../actions";

export default function NewCatalogItemPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/catalogs" className="text-sm text-muted hover:text-terra">
          ← Catalogs
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">New catalog item</h1>
      </div>
      <Card>
        <CatalogForm action={createCatalogAction} submitLabel="Create item" />
      </Card>
    </main>
  );
}
