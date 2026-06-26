"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { type BrandingFormState, updateBrandingCore } from "@/lib/branding";
import { putObject } from "@/lib/storage";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export async function saveBrandingAction(
  _prev: BrandingFormState,
  formData: FormData,
): Promise<BrandingFormState> {
  const { session, orgId } = await requireSection("settings");
  if (!orgId) return { error: "No organization is linked to your account." };

  // Optional logo upload. Goes through the storage client (stub or real); we persist the object KEY.
  let logoKey: string | undefined;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Logo must be an image file." };
    if (file.size > MAX_LOGO_BYTES) return { error: "Logo must be 2 MB or smaller." };
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const key = `branding/${orgId}/logo-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const put = await putObject({ key, body: bytes, contentType: file.type });
    if (!put.ok) return { error: "Could not upload the logo. Please try again." };
    logoKey = put.key;
  }

  const result = await updateBrandingCore(
    orgId,
    {
      logoKey, // undefined → leave existing logo as-is
      themeColor: String(formData.get("themeColor") ?? ""),
      fontKey: String(formData.get("fontKey") ?? ""),
      defaultLocale: String(formData.get("defaultLocale") ?? "en"),
      backgroundStyle: String(formData.get("backgroundStyle") ?? "stars_zodiac"),
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/settings/branding");
  revalidatePath("/dashboard");
  return { ok: true };
}
