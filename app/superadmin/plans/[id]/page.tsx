import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { PlanForm } from "../PlanForm";
import { deletePlanAction, setPlanActiveAction, updatePlanAction } from "../actions";

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) notFound();

  const defaults = {
    name: plan.name,
    priceRupees: (plan.price / 100).toString(),
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    includedSeats: plan.includedSeats,
    perSeatRupees: (plan.perSeatPrice / 100).toString(),
    features: JSON.stringify(plan.features, null, 2),
  };

  return (
    <>
      <PageHeader title={plan.name} />
      <div className="mx-auto w-full max-w-xl px-6 py-8 md:px-8">
        <div className="mb-4">
          <Link href="/superadmin/plans" className="text-sm text-muted hover:text-terra">
            ← Plans
          </Link>
          <p className="mt-1 text-sm text-muted">{plan.isActive ? "active" : "inactive"}</p>
        </div>

        {error && (
          <div className="mb-5 rounded-control border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-terra">
            {error}
          </div>
        )}

        <Card className="mb-5">
          <h2 className="mb-3 font-display text-lg text-ink">Edit plan</h2>
          <PlanForm action={updatePlanAction} planId={plan.id} defaults={defaults} submitLabel="Save" />
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-lg text-ink">{plan.isActive ? "Deactivate" : "Activate"}</h2>
          <p className="mb-3 text-sm text-muted">
            {plan.isActive
              ? "Deactivated plans can't be assigned to new consultants."
              : "Activating makes this plan assignable again."}
          </p>
          <form action={setPlanActiveAction}>
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="isActive" value={plan.isActive ? "false" : "true"} />
            <Button type="submit" variant={plan.isActive ? "ghost" : "primary"}>
              {plan.isActive ? "Deactivate" : "Activate"}
            </Button>
          </form>
        </Card>

        <Card className="mt-5 border-terra/40">
          <h2 className="mb-1 font-display text-lg text-ink">Delete plan</h2>
          <p className="mb-3 text-sm text-muted">
            Blocked if any consultant is on this plan or it has plan-scoped feature flags.
          </p>
          <ConfirmDeleteButton action={deletePlanAction} label="Delete plan">
            <input type="hidden" name="id" value={plan.id} />
          </ConfirmDeleteButton>
        </Card>
      </div>
    </>
  );
}
