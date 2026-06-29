"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { savePromoAction, type PromoFormState } from "@/app/superadmin/plans/promo-actions";
import type { Promo } from "@/lib/promo";

// SP — global promotional-banner config. Drives the marketing top banner + the display-only discounted prices
// on /pricing for the window. Reuses Input + useActionState like the other admin forms; dates use the shared
// DatePicker (controlled) with hidden inputs so the FormData submit shape is unchanged.
export function PromoForm({ promo }: { promo: Promo }) {
  const [state, action, pending] = useActionState<PromoFormState, FormData>(savePromoAction, {});
  const [startsAt, setStartsAt] = useState(promo.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(promo.endsAt ?? "");
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" name="enabled" defaultChecked={promo.enabled} className="h-4 w-4 accent-marigold" />
        Show the promotional banner (and discounted prices) during the window below
      </label>
      <Input name="name" label="Offer name" defaultValue={promo.name} placeholder="Father's Day Offer" />
      <Input name="tagline" label="Tagline" defaultValue={promo.tagline} placeholder="Discounts up to 50%" />
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink">Starts</span>
          <input type="hidden" name="startsAt" value={startsAt} />
          <DatePicker value={startsAt} onChange={setStartsAt} max={endsAt || undefined} clearable placeholder="Select date" ariaLabel="Promo start date" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink">Ends</span>
          <input type="hidden" name="endsAt" value={endsAt} />
          <DatePicker value={endsAt} onChange={setEndsAt} min={startsAt || undefined} clearable placeholder="Select date" ariaLabel="Promo end date" />
        </label>
      </div>
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Saved.</p>}
      <Button type="submit" loading={pending} loadingLabel="Saving…">Save banner</Button>
    </form>
  );
}
