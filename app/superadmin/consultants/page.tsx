import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { StatusChip, orgStatusTone, subStatusTone } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { deleteConsultantAction, setOrgStatusAction } from "./actions";

export default async function ConsultantsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  // SP-5.6: dashboard stat cards deep-link here filtered by active subscription / suspended status.
  const where: Prisma.OrganizationWhereInput =
    filter === "suspended" ? { status: "suspended" } : filter === "active" ? { subscription: { is: { status: "active" } } } : {};
  const orgs = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { email: true } },
      subscription: { include: { plan: { select: { name: true } } } },
    },
  });
  const filterLabel = filter === "suspended" ? "Suspended" : filter === "active" ? "Active subscriptions" : null;

  return (
    <>
      <PageHeader title="Consultants">
        <Link href="/superadmin/consultants/new">
          <Button>New consultant</Button>
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {filterLabel && (
          <div className="mb-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-marigold/15 px-3 py-1 text-ink">{filterLabel}</span>
            <Link href="/superadmin/consultants" className="text-terra hover:underline">Clear filter</Link>
          </div>
        )}
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
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Organization</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const suspended = org.status === "suspended";
                  return (
                    <tr key={org.id} className="border-b border-line transition last:border-0 hover:bg-sand-2/30">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/consultants/${org.id}`}>
                          {org.name}
                        </Link>
                        <div className="text-xs text-muted">/{org.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{org.owner?.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        {org.subscription ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-ink">{org.subscription.plan.name}</span>
                            <StatusChip label={org.subscription.status.replace("_", " ")} tone={subStatusTone(org.subscription.status)} />
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip label={org.status} tone={orgStatusTone(org.status)} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <form action={setOrgStatusAction}>
                            <input type="hidden" name="orgId" value={org.id} />
                            <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
                            <Button type="submit" variant="ghost">
                              {suspended ? "Reactivate" : "Suspend"}
                            </Button>
                          </form>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
