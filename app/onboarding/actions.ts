"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { completeOnboardingCore, type ProfileFormState } from "@/lib/consultant-profile";

export async function completeOnboardingAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account. Contact the operator." };

  const result = await completeOnboardingCore(
    orgId,
    {
      displayName: String(formData.get("displayName") ?? ""),
      businessType: String(formData.get("businessType") ?? ""),
      timezone: String(formData.get("timezone") ?? "Asia/Kolkata"),
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  redirect("/dashboard");
}
