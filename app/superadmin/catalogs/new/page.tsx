import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { CatalogForm } from "../CatalogForm";
import { createCatalogAction } from "../actions";

export default function NewCatalogItemPage() {
  return (
    <>
      <PageHeader title="New catalog item" />
      <div className="mx-auto w-full max-w-xl px-6 py-8 md:px-8">
        <Link href="/superadmin/catalogs" className="text-sm text-muted hover:text-terra">
          ← Catalogs
        </Link>
        <Card className="mt-4">
          <CatalogForm action={createCatalogAction} submitLabel="Create item" />
        </Card>
      </div>
    </>
  );
}
