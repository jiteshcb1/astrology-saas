import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { PlanForm } from "../PlanForm";
import { updatePlanAction } from "../actions";

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
      <PageHeader title={plan.name}>
        <StatusChip label={plan.isActive ? "active" : "inactive"} tone={plan.isActive ? "success" : "neutral"} />
      </PageHeader>
      <div className="mx-auto w-full max-w-xl px-6 py-6">
        <Link href="/superadmin/plans" className="text-sm text-muted hover:text-terra">
          ← Plans
        </Link>

        {error && (
          <div className="mt-4 rounded-control border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-terra">
            {error}
          </div>
        )}

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Edit plan</h2>
          <PlanForm action={updatePlanAction} planId={plan.id} defaults={defaults} submitLabel="Save" />
        </Card>
        <p className="mt-3 text-xs text-muted">Activate/deactivate and delete are available from the Plans list.</p>
      </div>
    </>
  );
}
