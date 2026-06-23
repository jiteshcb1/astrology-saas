"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { setFlagAction } from "./actions";

interface Option {
  id: string;
  name: string;
}

export function FlagForm({ plans, orgs }: { plans: Option[]; orgs: Option[] }) {
  const [state, action, pending] = useActionState(setFlagAction, {});
  const [scope, setScope] = useState("global");

  return (
    <form action={action} className="space-y-4">
      <Input name="key" label="Flag key" placeholder="round_robin" required />
      <Select name="scope" label="Scope" value={scope} onChange={(e) => setScope(e.target.value)}>
        <option value="global">Global</option>
        <option value="plan">Plan</option>
        <option value="org">Org (consultant)</option>
      </Select>
      {scope === "plan" && (
        <Select name="scopeId" label="Plan" defaultValue="" required>
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
        <Select name="scopeId" label="Consultant org" defaultValue="" required>
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
      <Select name="enabled" label="State" defaultValue="true">
        <option value="true">Enabled</option>
        <option value="false">Disabled</option>
      </Select>
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save flag"}
      </Button>
    </form>
  );
}
