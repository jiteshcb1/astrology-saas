import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { StatusChip, orgStatusTone, subStatusTone } from "@/components/ui/StatusChip";
import { PageHeader } from "@/components/superadmin/PageHeader";
import type { WizardPlan } from "@/components/superadmin/ConsultantWizard";
import { computeEffectivePrice, formatMoney } from "@/lib/billing";
import { ConsultantEditForm } from "../ConsultantEditForm";
import { AssignPlanForm } from "../AssignPlanForm";

export default async function ConsultantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [org, activePlans] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        owner: { select: { email: true, name: true } },
        subscription: { include: { plan: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        currency: true,
        billingInterval: true,
        includedSeats: true,
        perSeatPrice: true,
        features: true,
      },
    }),
  ]);
  if (!org) notFound();

  const sub = org.subscription;
  const activePlanOptions: WizardPlan[] = activePlans.map((p) => ({
    ...p,
    features: (p.features ?? {}) as Record<string, boolean>,
  }));
  const currentAdditionalSeats = sub ? Math.max(0, sub.seatCount - sub.plan.includedSeats) : 0;

  return (
    <>
      <PageHeader title={org.name}>
        <StatusChip label={org.status} tone={orgStatusTone(org.status)} />
      </PageHeader>
      <div className="mx-auto w-full max-w-3xl px-6 py-6">
        <Link href="/superadmin/consultants" className="text-sm text-muted hover:text-terra">
          ← Consultants
        </Link>

        {error && (
          <div className="mt-4 rounded-control border border-terra/40 bg-terra/10 px-4 py-3 text-sm text-terra">
            {error}
          </div>
        )}

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Details</h2>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Booking URL">/{org.slug}</ReadOnlyField>
              <ReadOnlyField label="Owner">{org.owner?.email ?? "—"}</ReadOnlyField>
            </div>
            <ConsultantEditForm orgId={org.id} name={org.name} />
          </div>
        </Card>

        <Card className="mt-4">
          <h2 className="mb-3 font-display text-lg text-ink">Plan &amp; billing</h2>
          {sub ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <ReadOnlyField label="Current plan">
                <span className="inline-flex items-center gap-2">
                  {sub.plan.name}
                  <StatusChip label={sub.status.replace("_", " ")} tone={subStatusTone(sub.status)} />
                </span>
              </ReadOnlyField>
              <ReadOnlyField label="Charge">
                {formatMoney(computeEffectivePrice(sub.plan, sub.seatCount), sub.plan.currency)} / {sub.plan.billingInterval}
                {sub.currentPeriodEnd ? ` · renews ${sub.currentPeriodEnd.toLocaleDateString("en-IN")}` : ""}
              </ReadOnlyField>
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted">No plan assigned yet.</p>
          )}
          <AssignPlanForm
            orgId={org.id}
            plans={activePlanOptions}
            currentPlanId={sub?.planId}
            currentAdditionalSeats={currentAdditionalSeats}
          />
        </Card>
      </div>
    </>
  );
}
