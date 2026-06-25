"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { updatePlatformLegalCore, type PlatformLegalResult } from "@/lib/platform-legal";

export async function savePlatformLegalAction(docType: string, html: string): Promise<PlatformLegalResult> {
  const { session } = await requireRole("access:superadmin");
  const result = await updatePlatformLegalCore(docType, html, session.user.id);
  if (result.ok) {
    revalidatePath("/superadmin/legal");
    revalidatePath(`/legal/${docType === "terms_of_use" ? "terms-of-use" : docType}`);
  }
  return result;
}
