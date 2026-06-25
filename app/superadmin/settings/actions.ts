"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { setEmailCategoryEnabled, type PlatformSettingResult } from "@/lib/platform-settings";

export async function setEmailCategoryAction(category: string, enabled: boolean): Promise<PlatformSettingResult> {
  const { session } = await requireRole("access:superadmin");
  const result = await setEmailCategoryEnabled(category, enabled, session.user.id);
  if (result.ok) revalidatePath("/superadmin/settings");
  return result;
}
