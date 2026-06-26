"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { type AvailabilityFormState, type OverrideInput, type RuleInput, saveAvailabilityCore } from "@/lib/availability";

export async function saveAvailabilityAction(
  _prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const { session, orgId, memberId, role } = await requireSection("availability");

  let rules: RuleInput[];
  let overrides: OverrideInput[];
  try {
    rules = JSON.parse(String(formData.get("rulesJson") ?? "[]"));
    overrides = JSON.parse(String(formData.get("overridesJson") ?? "[]"));
  } catch {
    return { error: "Could not read the availability data." };
  }

  const result = await saveAvailabilityCore(
    orgId,
    memberId,
    role === "consultant",
    { timezone: String(formData.get("timezone") ?? "Asia/Kolkata"), rules, overrides },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/availability");
  return { ok: true };
}
