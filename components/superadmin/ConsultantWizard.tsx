"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlugField } from "@/components/superadmin/SlugField";
import { CheckoutSummary } from "@/components/superadmin/CheckoutSummary";
import { buildCheckoutSummary } from "@/lib/checkout";
import type { ConsultantFormState } from "@/lib/consultants";

export interface WizardPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingInterval: "monthly" | "yearly";
  includedSeats: number;
  perSeatPrice: number;
  features: Record<string, boolean>;
}

type CreateAction = (prev: ConsultantFormState, fd: FormData) => Promise<ConsultantFormState>;
type CheckAvailability = (slug: string) => Promise<{ available: boolean; reason?: string }>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
          active || done ? "bg-marigold text-night" : "bg-line text-muted"
        }`}
      >
        {n}
      </span>
      <span className={active ? "text-ink" : "text-muted"}>{label}</span>
    </span>
  );
}

export function ConsultantWizard({
  bookingBase,
  plans,
  createAction,
  checkAvailability,
}: {
  bookingBase: string;
  plans: WizardPlan[];
  createAction: CreateAction;
  checkAvailability: CheckAvailability;
}) {
  const [state, formAction, pending] = useActionState(createAction, {});
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [slugReady, setSlugReady] = useState(false);
  const [planId, setPlanId] = useState("");
  const [additionalSeats, setAdditionalSeats] = useState(0);

  const step1Valid = orgName.trim().length > 0 && EMAIL_RE.test(ownerEmail) && slugReady;
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const summary = selectedPlan ? buildCheckoutSummary(selectedPlan, additionalSeats) : null;

  return (
    <form action={formAction}>
      <ol className="mb-6 flex items-center gap-3 text-sm">
        <StepDot n={1} label="Details" active={step === 1} done={step > 1} />
        <span className="h-px w-6 bg-line" />
        <StepDot n={2} label="Plan & seats" active={step === 2} done={false} />
      </ol>

      {/* Step 1 — Details (kept mounted so its inputs always submit) */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <Input
          name="orgName"
          label="Organization name"
          placeholder="Jyoti Astrology"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
        />
        <SlugField bookingBase={bookingBase} checkAvailability={checkAvailability} onValidityChange={setSlugReady} />
        <Input name="ownerName" label="Owner name" placeholder="Pandit Ravi Sharma" />
        <Input
          name="ownerEmail"
          type="email"
          label="Owner email"
          placeholder="owner@example.com"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Button type="button" disabled={!step1Valid} onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      </div>

      {/* Step 2 — Plan & seats */}
      <div className={step === 2 ? "grid gap-6 md:grid-cols-2" : "hidden"}>
        <div className="space-y-4">
          <Select name="planId" label="Plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">No plan (assign later)</option>
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
          <p className="text-xs text-muted">Seats beyond the {selectedPlan?.includedSeats ?? "—"} included in the plan.</p>
          {state.error && <p className="text-sm text-terra">{state.error}</p>}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create consultant"}
            </Button>
          </div>
        </div>
        <div>
          <CheckoutSummary summary={summary} />
        </div>
      </div>
    </form>
  );
}
