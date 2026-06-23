import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { deleteCatalogAction, toggleCatalogAction } from "./actions";

function valueSummary(type: string, value: unknown): string {
  const v = (value ?? {}) as Record<string, unknown>;
  if (type === "theme_color") return String(v.hex ?? "—");
  if (type === "font") return [v.script, v.fontFamily].filter(Boolean).join(" · ") || "—";
  return "—";
}

export default async function CatalogsPage() {
  const items = await prisma.catalogItem.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Catalogs</h1>
        <Link href="/superadmin/catalogs/new">
          <Button>New item</Button>
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted">
        Suggested theme colors, fonts, and calendar providers offered to consultants (SP-2).
      </p>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Key</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={6}>
                  No catalog items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-muted">{item.type}</td>
                  <td className="px-4 py-3">
                    <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/catalogs/${item.id}`}>
                      {item.key}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{item.label}</td>
                  <td className="px-4 py-3 text-muted">{valueSummary(item.type, item.value)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.isActive ? "bg-green/15 text-green" : "bg-terra/15 text-terra"
                      }`}
                    >
                      {item.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <form action={toggleCatalogAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isActive" value={item.isActive ? "false" : "true"} />
                        <Button type="submit" variant="ghost">
                          {item.isActive ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      <form action={deleteCatalogAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="ghost">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
