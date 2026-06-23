import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { deleteConsultantAction } from "./actions";

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
    <>
      <PageHeader title="Consultants">
        <Link href="/superadmin/consultants/new">
          <Button>New consultant</Button>
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8">
        {orgs.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState
              title="No consultants yet"
              message="Create the first consultant to provision an org, owner, and booking page."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/consultants/${org.id}`}>
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">/{org.slug}</td>
                    <td className="px-4 py-3 text-muted">{org.owner?.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {org.subscription ? `${org.subscription.plan.name} (${org.subscription.status})` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          org.status === "active" ? "bg-green/15 text-green" : "bg-terra/15 text-terra"
                        }`}
                      >
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/superadmin/consultants/${org.id}`}
                          className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold"
                        >
                          Edit
                        </Link>
                        <ConfirmDeleteButton action={deleteConsultantAction}>
                          <input type="hidden" name="orgId" value={org.id} />
                        </ConfirmDeleteButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
