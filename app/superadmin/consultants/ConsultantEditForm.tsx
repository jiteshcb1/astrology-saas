"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateConsultantAction } from "./actions";

export function ConsultantEditForm({ orgId, name }: { orgId: string; name: string }) {
  const [state, action, pending] = useActionState(updateConsultantAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orgId" value={orgId} />
      <Input name="orgName" label="Organization name" defaultValue={name} required />
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
