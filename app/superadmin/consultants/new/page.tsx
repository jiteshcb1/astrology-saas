import Link from "next/link";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { ConsultantWizard, type WizardPlan } from "@/components/superadmin/ConsultantWizard";
import { checkSlugAvailability, createConsultantWithPlanAction } from "../actions";

export default async function NewConsultantPage() {
  const plans = await prisma.subscriptionPlan.findMany({
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
  });
  const wizardPlans: WizardPlan[] = plans.map((p) => ({
    ...p,
    features: (p.features ?? {}) as Record<string, boolean>,
  }));

  return (
    <>
      <PageHeader title="New consultant" />
      <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8">
        <Link href="/superadmin/consultants" className="text-sm text-muted hover:text-terra">
          ← Consultants
        </Link>
        <Card className="mt-4">
          <ConsultantWizard
            bookingBase={env.AUTH_URL}
            plans={wizardPlans}
            createAction={createConsultantWithPlanAction}
            checkAvailability={checkSlugAvailability}
          />
        </Card>
      </div>
    </>
  );
}
