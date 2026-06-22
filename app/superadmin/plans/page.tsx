import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/billing";

export default async function PlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Plans</h1>
        <Link href="/superadmin/plans/new">
          <Button>New plan</Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Interval</th>
              <th className="px-4 py-3 font-medium">Base price</th>
              <th className="px-4 py-3 font-medium">Incl. seats</th>
              <th className="px-4 py-3 font-medium">Per seat</th>
              <th className="px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={6}>
                  No plans yet. Create the first one.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-line last:border-0">
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        plan.isActive ? "bg-green/15 text-green" : "bg-terra/15 text-terra"
                      }`}
                    >
                      {plan.isActive ? "active" : "inactive"}
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
