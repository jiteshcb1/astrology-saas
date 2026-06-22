import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";

export default async function ConsultantsPage() {
  // Super admin is cross-tenant by design; organizations is the tenant root (not org-scoped).
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { email: true } },
      subscription: { include: { plan: { select: { name: true } } } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Consultants</h1>
        <Link href="/superadmin/consultants/new">
          <Button>New consultant</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  No consultants yet. Create the first one.
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/consultants/${org.id}`}>
                      {org.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">/{org.slug}</td>
                  <td className="px-4 py-3 text-muted">{org.owner?.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {org.subscription
                      ? `${org.subscription.plan.name} (${org.subscription.status})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        org.status === "active"
                          ? "bg-green/15 text-green"
                          : "bg-terra/15 text-terra"
                      }`}
                    >
                      {org.status}
                    </span>
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
