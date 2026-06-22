"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createConsultantAction } from "./actions";

export function ConsultantCreateForm() {
  const [state, action, pending] = useActionState(createConsultantAction, {});
  return (
    <form action={action} className="space-y-4">
      <Input name="orgName" label="Organization name" placeholder="Jyoti Astrology" required />
      <Input name="slug" label="Slug (booking URL path)" placeholder="jyoti-astrology" required />
      <Input name="ownerName" label="Owner name" placeholder="Pandit Ravi Sharma" />
      <Input name="ownerEmail" type="email" label="Owner email" placeholder="owner@example.com" required />
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create consultant"}
      </Button>
    </form>
  );
}
