"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import {
  buildSocialLinks,
  parseSpecialities,
  type ProfileFormState,
  updateProfileCore,
} from "@/lib/consultant-profile";

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };

  const result = await updateProfileCore(
    orgId,
    {
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      experience: String(formData.get("experience") ?? ""),
      specialities: parseSpecialities(String(formData.get("specialities") ?? "")),
      socialLinks: buildSocialLinks({
        website: String(formData.get("website") ?? ""),
        instagram: String(formData.get("instagram") ?? ""),
        youtube: String(formData.get("youtube") ?? ""),
        x: String(formData.get("x") ?? ""),
      }),
      gstNumber: String(formData.get("gstNumber") ?? ""),
      gstLegalName: String(formData.get("gstLegalName") ?? ""),
      complaintsContactNumber: String(formData.get("complaintsContactNumber") ?? ""),
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/settings/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
