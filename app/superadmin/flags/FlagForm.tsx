"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FlagFormState } from "@/lib/flags";
import { setFlagAction } from "./actions";

interface Option {
  id: string;
  name: string;
}

type Action = (prev: FlagFormState, formData: FormData) => Promise<FlagFormState>;

export interface FlagFormDefaults {
  key: string;
  scope: string;
  scopeId: string | null;
  enabled: boolean;
}

export function FlagForm({
  plans,
  orgs,
  action = setFlagAction,
  flagId,
  defaults,
  submitLabel = "Save flag",
}: {
  plans: Option[];
  orgs: Option[];
  action?: Action;
  flagId?: string;
  defaults?: FlagFormDefaults;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [scope, setScope] = useState(defaults?.scope ?? "global");

  return (
    <form action={formAction} className="space-y-4">
      {flagId && <input type="hidden" name="id" value={flagId} />}
      <Input name="key" label="Flag key" placeholder="round_robin" defaultValue={defaults?.key} required />
      <Select name="scope" label="Scope" value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="global">Global</option>
        <option value="plan">Plan</option>
        <option value="org">Org (consultant)</option>
      </Select>
      {scope === "plan" && (
        <Select name="scopeId" label="Plan" defaultValue={defaults?.scope === "plan" ? defaults?.scopeId ?? "" : ""} required>
          <option value="" disabled>
            Select a plan…
          </option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      {scope === "org" && (
        <Select name="scopeId" label="Consultant org" defaultValue={defaults?.scope === "org" ? defaults?.scopeId ?? "" : ""} required>
          <option value="" disabled>
            Select an org…
          </option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      )}
      <Select name="enabled" label="State" defaultValue={defaults ? (defaults.enabled ? "true" : "false") : "true"}>
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </Select>
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
