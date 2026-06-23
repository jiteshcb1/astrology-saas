"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import {
  deleteFlagCore,
  type FlagFormState,
  setFlagCore,
  setFlagEnabledCore,
  updateFlagCore,
} from "@/lib/flags";

function parseScope(raw: string): "global" | "plan" | "org" | null {
  return raw === "global" || raw === "plan" || raw === "org" ? raw : null;
}

export async function setFlagAction(
  _prev: FlagFormState,
  formData: FormData,
): Promise<FlagFormState> {
  const { session } = await requireRole("access:superadmin");
  const scope = parseScope(String(formData.get("scope") ?? ""));
  if (!scope) return { error: "Invalid scope." };
  const scopeIdRaw = String(formData.get("scopeId") ?? "").trim();
  const result = await setFlagCore(
    {
      key: String(formData.get("key") ?? ""),
      scope,
      scopeId: scope === "global" ? null : scopeIdRaw || null,
      enabled: String(formData.get("enabled") ?? "true") === "true",
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/flags");
  redirect("/superadmin/flags");
}

export async function updateFlagAction(
  _prev: FlagFormState,
  formData: FormData,
): Promise<FlagFormState> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  const scope = parseScope(String(formData.get("scope") ?? ""));
  if (!scope) return { error: "Invalid scope." };
  const scopeIdRaw = String(formData.get("scopeId") ?? "").trim();
  const result = await updateFlagCore(
    id,
    {
      key: String(formData.get("key") ?? ""),
      scope,
      scopeId: scope === "global" ? null : scopeIdRaw || null,
      enabled: String(formData.get("enabled") ?? "true") === "true",
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/flags");
  redirect("/superadmin/flags");
}

export async function toggleFlagAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  await setFlagEnabledCore(id, enabled, session.user.id);
  revalidatePath("/superadmin/flags");
}

export async function deleteFlagAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const id = String(formData.get("id") ?? "");
  await deleteFlagCore(id, session.user.id);
  revalidatePath("/superadmin/flags");
}
