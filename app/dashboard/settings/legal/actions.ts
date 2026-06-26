"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { updateLegalCore, type LegalFormState } from "@/lib/legal";

export async function saveLegalAction(_prev: LegalFormState, formData: FormData): Promise<LegalFormState> {
  const { session, orgId } = await requireSection("settings");
  if (!orgId) return { error: "No organization is linked to your account." };

  const result = await updateLegalCore(
    orgId,
    {
      privacyPolicy: String(formData.get("privacyPolicy") ?? ""),
      termsConditions: String(formData.get("termsConditions") ?? ""),
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/settings/legal");
  revalidatePath("/dashboard");
  return { ok: true };
}
