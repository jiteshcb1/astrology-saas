import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeEffectivePrice, formatMoney } from "@/lib/billing";
import { ConsultantEditForm } from "../ConsultantEditForm";
import { AssignPlanForm } from "../AssignPlanForm";
import { setOrgStatusAction } from "../actions";

export default async function ConsultantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      select: { id: true, name: true },
    }),
  ]);
  if (!org) notFound();

  const suspended = org.status === "suspended";
  const sub = org.subscription;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <div className="mb-6">
        <Link href="/superadmin/consultants" className="text-sm text-muted hover:text-terra">
          ← Consultants
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">{org.name}</h1>
        <p className="text-sm text-muted">
          /{org.slug} · owner {org.owner?.email ?? "—"} · status {org.status}
        </p>
      </div>

      <Card className="mb-5">
        <h2 className="mb-3 font-display text-lg text-ink">Details</h2>
        <p className="mb-3 text-sm text-muted">
          Slug <code className="text-ink">/{org.slug}</code> is fixed for the life of the org
          (immutable public URL in Phase 1).
        </p>
        <ConsultantEditForm orgId={org.id} name={org.name} />
      </Card>

      <Card className="mb-5">
        <h2 className="mb-1 font-display text-lg text-ink">Plan &amp; billing</h2>
        {sub ? (
          <p className="mb-3 text-sm text-muted">
            Current: <span className="text-ink">{sub.plan.name}</span> · {sub.seatCount} seat
            {sub.seatCount === 1 ? "" : "s"} · status {sub.status} ·{" "}
            <span className="text-ink">
              {formatMoney(computeEffectivePrice(sub.plan, sub.seatCount), sub.plan.currency)}
            </span>{" "}
            / {sub.plan.billingInterval}
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted">No plan assigned yet.</p>
        )}
        <AssignPlanForm
          orgId={org.id}
          plans={activePlans}
          currentPlanId={sub?.planId}
          currentSeatCount={sub?.seatCount}
        />
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">
          {suspended ? "Reactivate" : "Suspend"}
        </h2>
        <p className="mb-3 text-sm text-muted">
          {suspended
            ? "Reactivating brings the public booking page back online."
            : "Suspending takes the public booking page offline (404)."}
        </p>
        <form action={setOrgStatusAction}>
          <input type="hidden" name="orgId" value={org.id} />
          <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
          <Button type="submit" variant={suspended ? "primary" : "ghost"}>
            {suspended ? "Reactivate" : "Suspend"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
