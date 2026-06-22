import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PlanForm } from "../PlanForm";
import { setPlanActiveAction, updatePlanAction } from "../actions";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/plans" className="text-sm text-muted hover:text-terra">
          ← Plans
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">{plan.name}</h1>
        <p className="text-sm text-muted">{plan.isActive ? "active" : "inactive"}</p>
      </div>

      <Card className="mb-5">
        <h2 className="mb-3 font-display text-lg text-ink">Edit plan</h2>
        <PlanForm action={updatePlanAction} planId={plan.id} defaults={defaults} submitLabel="Save" />
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">
          {plan.isActive ? "Deactivate" : "Activate"}
        </h2>
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
    </main>
  );
}
