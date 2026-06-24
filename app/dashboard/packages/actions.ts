"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import {
  deletePackageCore,
  type FreqLimit,
  type PackageFormState,
  parseDurations,
  savePackageCore,
  setPackageActiveCore,
} from "@/lib/packages";

function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
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
  revalidatePath("/dashboard/packages");
  revalidatePath("/dashboard");
  redirect("/dashboard/packages");
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
