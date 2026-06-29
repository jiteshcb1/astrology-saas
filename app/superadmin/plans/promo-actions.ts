"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { savePromoCore, type Promo } from "@/lib/promo";

export type PromoFormState = { ok?: boolean; error?: string };

// Save the global promotional-banner campaign (display-only). Re-checks super_admin; refreshes the marketing
// layout (the banner lives there) + the plans page.
export async function savePromoAction(_prev: PromoFormState, formData: FormData): Promise<PromoFormState> {
  const { session } = await requireRole("access:superadmin");
  const input: Promo = {
    enabled: formData.get("enabled") === "on",
    name: String(formData.get("name") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    startsAt: String(formData.get("startsAt") ?? "") || null,
    endsAt: String(formData.get("endsAt") ?? "") || null,
  };
  const res = await savePromoCore(input, session.user.id);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout"); // banner is rendered in the marketing layout
  revalidatePath("/superadmin/plans");
  return { ok: true };
}
