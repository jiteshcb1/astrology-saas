"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { revokeCalendarCore } from "@/lib/calendar";

// Track I T-1.1 — disconnect: revoke at Google, then delete the encrypted tokens locally. Re-checks the role
// guard on every call (owner or consulting member, their own connection).
export async function disconnectCalendarAction(): Promise<void> {
  const { session, orgId, memberId } = await requireSection("calendar");
  await revokeCalendarCore(orgId, memberId, session.user.id);
  revalidatePath("/dashboard/settings/calendar");
  revalidatePath("/dashboard");
}
