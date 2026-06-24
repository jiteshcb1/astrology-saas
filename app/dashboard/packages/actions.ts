"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import {
  deletePackageCore,
  type FreqLimit,
  isPackageSlugAvailable,
  type PackageFormState,
  parseDurations,
  type QuestionInput,
  saveQuestionsCore,
  savePackageCore,
  setPackageActiveCore,
} from "@/lib/packages";

function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

// Parse the questions hidden field (JSON serialized by QuestionsBuilder). Tolerant of bad input.
function parseQuestions(v: FormDataEntryValue | null): QuestionInput[] {
  try {
    const arr = JSON.parse(String(v ?? "[]"));
    return Array.isArray(arr) ? (arr as QuestionInput[]) : [];
  } catch {
    return [];
  }
}

export async function savePackageAction(_prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };

  const id = String(formData.get("id") ?? "") || undefined;
  const durations = parseDurations(formData.getAll("durations").map(String));
  const freq: FreqLimit = {};
  if (formData.get("per_day")) freq.per_day = num(formData.get("per_day"));
  if (formData.get("per_week")) freq.per_week = num(formData.get("per_week"));
  if (formData.get("per_month")) freq.per_month = num(formData.get("per_month"));

  const result = await savePackageCore(
    orgId,
    {
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? "") || String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      allowedDurations: durations,
      defaultDurationMin: num(formData.get("defaultDurationMin"), durations[0] ?? 30),
      allowBookerChooseDuration: formData.get("allowBookerChooseDuration") === "on",
      price: Math.round(num(formData.get("priceRupees")) * 100), // rupees → paise
      bufferBeforeMin: num(formData.get("bufferBeforeMin")),
      bufferAfterMin: num(formData.get("bufferAfterMin")),
      minNoticeMin: num(formData.get("minNoticeMin")),
      slotIntervalMin: num(formData.get("slotIntervalMin"), 15),
      freqLimit: freq,
    },
    session.user.id,
    id,
  );
  if (!result.ok) return { error: result.error };
  await saveQuestionsCore(orgId, result.id, parseQuestions(formData.get("questions")), session.user.id);
  revalidatePath("/dashboard/packages");
  revalidatePath("/dashboard");
  redirect("/dashboard/packages");
}

// Live availability check for the slug field (per-org; excludes the package being edited).
export async function checkPackageSlugAction(
  slugRaw: string,
  excludeId?: string,
): Promise<{ available: boolean; reason?: string }> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { available: false, reason: "no-org" };
  const available = await isPackageSlugAvailable(orgId, slugRaw, excludeId);
  return { available, reason: available ? undefined : "taken" };
}

// Like savePackageAction but for an existing package and WITHOUT the redirect — used by the landing
// preview panel so the workspace stays open. Reuses savePackageCore (no duplicated mutation logic).
export async function quickSavePackageAction(_prev: PackageFormState, formData: FormData): Promise<PackageFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing package id." };

  const durations = parseDurations(formData.getAll("durations").map(String));
  const freq: FreqLimit = {};
  if (formData.get("per_day")) freq.per_day = num(formData.get("per_day"));
  if (formData.get("per_week")) freq.per_week = num(formData.get("per_week"));
  if (formData.get("per_month")) freq.per_month = num(formData.get("per_month"));

  const result = await savePackageCore(
    orgId,
    {
      title: String(formData.get("title") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      allowedDurations: durations,
      defaultDurationMin: num(formData.get("defaultDurationMin"), durations[0] ?? 30),
      allowBookerChooseDuration: formData.get("allowBookerChooseDuration") === "on",
      price: Math.round(num(formData.get("priceRupees")) * 100),
      bufferBeforeMin: num(formData.get("bufferBeforeMin")),
      bufferAfterMin: num(formData.get("bufferAfterMin")),
      minNoticeMin: num(formData.get("minNoticeMin")),
      slotIntervalMin: num(formData.get("slotIntervalMin"), 15),
      freqLimit: freq,
    },
    session.user.id,
    id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/packages");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setPackageActiveAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return;
  await setPackageActiveCore(orgId, String(formData.get("id")), formData.get("isActive") === "true", session.user.id);
  revalidatePath("/dashboard/packages");
}

export async function deletePackageAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return;
  // Guard inside the core blocks deletion when bookings exist (it deactivates instead).
  await deletePackageCore(orgId, String(formData.get("id")), session.user.id);
  revalidatePath("/dashboard/packages");
}
