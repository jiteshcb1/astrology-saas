"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { setEmailSetting, type PlatformSettingResult } from "@/lib/platform-settings";

export async function setEmailSettingAction(key: string, enabled: boolean): Promise<PlatformSettingResult> {
  const { session } = await requireRole("access:superadmin");
  const result = await setEmailSetting(key, enabled, session.user.id);
  if (result.ok) revalidatePath("/superadmin/settings/email-notifications");
  return result;
}
