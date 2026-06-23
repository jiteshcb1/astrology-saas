"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CheckoutSummary } from "@/components/superadmin/CheckoutSummary";
import type { WizardPlan } from "@/components/superadmin/ConsultantWizard";
import { buildCheckoutSummary } from "@/lib/checkout";
import { assignPlanAction } from "./actions";

export function AssignPlanForm({
  orgId,
  plans,
  currentPlanId,
  currentAdditionalSeats,
}: {
  orgId: string;
  plans: WizardPlan[];
  currentPlanId?: string;
  currentAdditionalSeats?: number;
}) {
  const [state, action, pending] = useActionState(assignPlanAction, {});
  const [planId, setPlanId] = useState(currentPlanId ?? "");
  const [additionalSeats, setAdditionalSeats] = useState(currentAdditionalSeats ?? 0);

  if (plans.length === 0) {
    return <p className="text-sm text-muted">No active plans yet — create one under Plans first.</p>;
  }

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const summary = selectedPlan ? buildCheckoutSummary(selectedPlan, additionalSeats) : null;

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <input type="hidden" name="orgId" value={orgId} />
        <Select name="planId" label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          <option value="" disabled>
            Select a plan…
          </option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          name="additionalSeats"
          label="Additional seats"
          type="number"
          min="0"
          step="1"
          value={String(additionalSeats)}
          onChange={(e) => setAdditionalSeats(Math.max(0, Number(e.target.value) || 0))}
        />
        <p className="text-xs text-muted">Seats beyond the {selectedPlan?.includedSeats ?? "—"} included.</p>
        {state.error && <p className="text-sm text-terra">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Assign plan"}
        </Button>
      </div>
      <CheckoutSummary summary={summary} />
    </form>
  );
}
