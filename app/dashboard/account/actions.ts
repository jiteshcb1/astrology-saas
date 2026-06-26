"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/rbac";
import { updateMyAccountCore, type AccountFormState } from "@/lib/account";

export async function saveAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const { session } = await requireSection("account");
  const result = await updateMyAccountCore(session.user.id, {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/account");
  return { ok: true };
}
