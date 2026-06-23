import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { StatusChip } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { formatMoney } from "@/lib/billing";
import { deletePlanAction, setPlanActiveAction } from "./actions";

export default async function PlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader title="Plans">
        <Link href="/superadmin/plans/new">
          <Button>New plan</Button>
        </Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {plans.length === 0 ? (
          <div className="rounded-card border border-line bg-white">
            <EmptyState title="No plans yet" message="Create a subscription plan to assign to consultants." />
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sand-2/40 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Interval</th>
                  <th className="px-4 py-2.5 font-medium">Base price</th>
                  <th className="px-4 py-2.5 font-medium">Incl. seats</th>
                  <th className="px-4 py-2.5 font-medium">Per seat</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-line transition last:border-0 hover:bg-sand-2/30">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-ink hover:text-terra" href={`/superadmin/plans/${plan.id}`}>
                        {plan.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{plan.billingInterval}</td>
                    <td className="px-4 py-3">{formatMoney(plan.price, plan.currency)}</td>
                    <td className="px-4 py-3 text-muted">{plan.includedSeats}</td>
                    <td className="px-4 py-3">{formatMoney(plan.perSeatPrice, plan.currency)}</td>
                    <td className="px-4 py-3">
                      <StatusChip label={plan.isActive ? "active" : "inactive"} tone={plan.isActive ? "success" : "neutral"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <form action={setPlanActiveAction}>
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="isActive" value={plan.isActive ? "false" : "true"} />
                          <Button type="submit" variant="ghost">
                            {plan.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                        <Link
                          href={`/superadmin/plans/${plan.id}`}
                          className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold"
                        >
                          Edit
                        </Link>
                        <ConfirmDeleteButton action={deletePlanAction}>
                          <input type="hidden" name="id" value={plan.id} />
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
