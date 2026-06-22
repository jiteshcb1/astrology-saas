"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { assignPlanAction } from "./actions";

interface PlanOption {
  id: string;
  name: string;
}

export function AssignPlanForm({
  orgId,
  plans,
  currentPlanId,
  currentSeatCount,
}: {
  orgId: string;
  plans: PlanOption[];
  currentPlanId?: string;
  currentSeatCount?: number;
}) {
  const [state, action, pending] = useActionState(assignPlanAction, {});

  if (plans.length === 0) {
    return <p className="text-sm text-muted">No active plans yet — create one under Plans first.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <Select name="planId" label="Plan" defaultValue={currentPlanId ?? ""} required>
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
        name="seatCount"
        label="Seat count"
        type="number"
        min="1"
        step="1"
        defaultValue={String(currentSeatCount ?? 1)}
        required
      />
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Assign plan"}
      </Button>
    </form>
  );
}
