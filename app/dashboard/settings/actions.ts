"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { getBranding } from "@/lib/branding";
import { generateProfileContent, isAiConfigured, localeFromChoice, type GenResult, type ProfileGen } from "@/lib/gemini";
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

// AI profile content (SP-4.6) — gated to the consultant; key + locale read server-side; never throws.
export async function generateProfileContentAction(answers: Record<string, unknown>): Promise<GenResult<ProfileGen>> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId || !isAiConfigured()) return { ok: false };
  // Language is chosen in the questionnaire ("language" step); fall back to branding default, then English.
  const branding = await getBranding(orgId);
  const locale = localeFromChoice(answers.language) ?? branding?.defaultLocale ?? "en";
  return generateProfileContent(answers, locale);
}
