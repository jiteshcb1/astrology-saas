"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import { saveAccountAction } from "@/app/dashboard/account/actions";
import type { AccountFormState } from "@/lib/account";

export function AccountForm({ defaults }: { defaults: { name: string; phone: string; email: string } }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(saveAccountAction, {});
  return (
    <Card>
      <form action={action} className="space-y-4">
        <Input name="name" label="Name" defaultValue={defaults.name} placeholder="Your full name" required />
        <Input name="phone" label="Phone" defaultValue={defaults.phone} placeholder="+91 98xxx xxxxx" />
        <ReadOnlyField label="Email">{defaults.email || "—"}</ReadOnlyField>
        {state.error && <p className="text-sm text-terra">{state.error}</p>}
        {state.ok && <p className="text-sm text-green">Saved.</p>}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </form>
    </Card>
  );
}
