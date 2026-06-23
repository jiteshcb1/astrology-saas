"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { CatalogFormState } from "@/lib/catalog";

type Action = (prev: CatalogFormState, formData: FormData) => Promise<CatalogFormState>;

export interface CatalogFormDefaults {
  type: string;
  key: string;
  label: string;
  sortOrder: number;
  hex?: string;
  script?: string;
  fontFamily?: string;
}

export function CatalogForm({
  action,
  id,
  defaults,
  submitLabel,
}: {
  action: Action;
  id?: string;
  defaults?: CatalogFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState(defaults?.type ?? "theme_color");

  return (
    <form action={formAction} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      <Select name="type" label="Type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="theme_color">Theme color</option>
        <option value="font">Font</option>
        <option value="calendar_provider">Calendar provider</option>
      </Select>
      <Input name="key" label="Key" placeholder="marigold" defaultValue={defaults?.key} required />
      <Input name="label" label="Display name" placeholder="Temple Marigold" defaultValue={defaults?.label} required />

      {type === "theme_color" && (
        <Input name="hex" label="Hex color" placeholder="#e8a33d" defaultValue={defaults?.hex} />
      )}
      {type === "font" && (
        <>
          <Select name="script" label="Script" defaultValue={defaults?.script ?? "latin"}>
            <option value="latin">Latin</option>
            <option value="devanagari">Devanagari</option>
          </Select>
          <Input name="fontFamily" label="Font family" placeholder="Fraunces" defaultValue={defaults?.fontFamily} />
        </>
      )}

      <Input
        name="sortOrder"
        label="Sort order"
        type="number"
        step="1"
        defaultValue={String(defaults?.sortOrder ?? 0)}
      />
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
