"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlugField } from "@/components/ui/SlugField";
import { DURATION_OPTIONS, type PackageFormState } from "@/lib/packages";
import { checkPackageSlugAction, savePackageAction } from "@/app/dashboard/packages/actions";

export interface PackageFormDefaults {
  id?: string;
  title: string;
  slug: string;
  description: string;
  allowedDurations: number[];
  defaultDurationMin: number;
  allowBookerChooseDuration: boolean;
  priceRupees: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotIntervalMin: number;
  per_day: string;
  per_week: string;
  per_month: string;
}

const textareaClass =
  "w-full rounded-control border border-line bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-marigold";

export function PackageForm({ defaults, bookingBase }: { defaults: PackageFormDefaults; bookingBase: string }) {
  const [state, action, pending] = useActionState<PackageFormState, FormData>(savePackageAction, {});
  const [slugReady, setSlugReady] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <Card>
        <h2 className="mb-3 font-display text-lg text-ink">Details</h2>
        <div className="space-y-3">
          <Input name="title" label="Title" defaultValue={defaults.title} placeholder="Kundali Reading" required />
          <SlugField
            name="slug"
            label="Booking link"
            bookingBase={bookingBase}
            initialValue={defaults.slug}
            placeholder="kundali-reading"
            checkAvailability={(slug) => checkPackageSlugAction(slug, defaults.id)}
            onValidityChange={setSlugReady}
          />
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">Description</span>
            <textarea name="description" rows={3} defaultValue={defaults.description} className={textareaClass} placeholder="What this session covers…" />
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-display text-lg text-ink">Duration &amp; price</h2>
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-sm text-muted">Allowed durations</span>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <label key={d} className="cursor-pointer">
                  <input type="checkbox" name="durations" value={d} defaultChecked={defaults.allowedDurations.includes(d)} className="peer sr-only" />
                  <span className="inline-block rounded-control border border-line px-3 py-1.5 text-sm text-muted transition peer-checked:border-marigold peer-checked:bg-marigold/10 peer-checked:text-ink">
                    {d} min
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select name="defaultDurationMin" label="Default duration" defaultValue={String(defaults.defaultDurationMin)}>
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </Select>
            <Input name="priceRupees" type="number" min="0" step="1" label="Price (₹)" defaultValue={defaults.priceRupees} placeholder="1100" required />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="allowBookerChooseDuration" defaultChecked={defaults.allowBookerChooseDuration} className="h-4 w-4 accent-marigold" />
            Let the seeker choose the duration
          </label>
          <p className="text-xs text-muted">Location is Google Meet (added automatically on confirmation).</p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-display text-lg text-ink">Booking limits</h2>
        <p className="mb-3 text-sm text-muted">Protect your calendar. Slots are computed to respect these.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="bufferBeforeMin" type="number" min="0" label="Buffer before (min)" defaultValue={String(defaults.bufferBeforeMin)} />
          <Input name="bufferAfterMin" type="number" min="0" label="Buffer after (min)" defaultValue={String(defaults.bufferAfterMin)} />
          <Input name="minNoticeMin" type="number" min="0" label="Minimum notice (min)" defaultValue={String(defaults.minNoticeMin)} />
          <Input name="slotIntervalMin" type="number" min="5" label="Slot interval (min)" defaultValue={String(defaults.slotIntervalMin)} />
          <Input name="per_day" type="number" min="0" label="Max per day (optional)" defaultValue={defaults.per_day} />
          <Input name="per_week" type="number" min="0" label="Max per week (optional)" defaultValue={defaults.per_week} />
          <Input name="per_month" type="number" min="0" label="Max per month (optional)" defaultValue={defaults.per_month} />
        </div>
      </Card>

      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending || !slugReady}>{pending ? "Saving…" : "Save package"}</Button>
    </form>
  );
}
