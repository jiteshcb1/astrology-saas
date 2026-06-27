"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { updateLeadStatusCore } from "@/lib/leads";

// SP-6.3 — update a lead's pipeline status (audit-logged in the core). Re-checks super_admin.
export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const leadId = String(formData.get("leadId") ?? "");
  const status = String(formData.get("status") ?? "");
  await updateLeadStatusCore(leadId, status, session.user.id);
  revalidatePath("/superadmin/leads");
  revalidatePath(`/superadmin/leads/${leadId}`);
}
