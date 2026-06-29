"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PlanFormState } from "@/lib/billing";

type Action = (prev: PlanFormState, formData: FormData) => Promise<PlanFormState>;

export interface PlanFormDefaults {
  name: string;
  priceRupees: string;
  currency: string;
  billingInterval: string;
  includedSeats: number;
  perSeatRupees: string;
  features: string;
  discountMode: "none" | "free" | "amount";
  discountedRupees: string;
}

export function PlanForm({
  action,
  planId,
  defaults,
  submitLabel,
}: {
  action: Action;
  planId?: string;
  defaults?: PlanFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [discountMode, setDiscountMode] = useState<string>(defaults?.discountMode ?? "none");
  return (
    <form action={formAction} className="space-y-3">
      {planId && <input type="hidden" name="planId" value={planId} />}
      <Input name="name" label="Plan name" defaultValue={defaults?.name} placeholder="Pro" required />
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="price"
          label="Base price (₹)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.priceRupees}
          required
        />
        <Select name="billingInterval" label="Interval" defaultValue={defaults?.billingInterval ?? "monthly"}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="includedSeats"
          label="Included seats"
          type="number"
          min="0"
          step="1"
          defaultValue={String(defaults?.includedSeats ?? 1)}
          required
        />
        <Input
          name="perSeatPrice"
          label="Per extra seat (₹)"
          type="number"
          step="0.01"
          min="0"
          defaultValue={defaults?.perSeatRupees ?? "0"}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select name="discountMode" label="Discount (display-only)" value={discountMode} onChange={(e) => setDiscountMode(e.target.value)}>
          <option value="none">No discount</option>
          <option value="free">Free</option>
          <option value="amount">Custom amount</option>
        </Select>
        {discountMode === "amount" ? (
          <Input name="discountedPrice" label="Discounted price (₹)" type="number" step="0.01" min="0" defaultValue={defaults?.discountedRupees ?? ""} required />
        ) : (
          <div />
        )}
      </div>
      <Input name="currency" label="Currency" defaultValue={defaults?.currency ?? "INR"} required />
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Features (JSON object of key → true/false)</span>
        <textarea
          name="features"
          rows={3}
          defaultValue={defaults?.features ?? "{}"}
          className="w-full rounded-control border border-line bg-white px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-marigold"
        />
      </label>
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" loading={pending} loadingLabel="Saving…">
        {submitLabel}
      </Button>
    </form>
  );
}
