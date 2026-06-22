"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import {
  createPlanCore,
  parseFeatures,
  type PlanFormState,
  type PlanInput,
  setPlanActiveCore,
  updatePlanCore,
} from "@/lib/billing";

function rupeesToPaise(raw: string): number {
  const n = Number((raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return Math.round(n * 100);
}

function readPlanInput(formData: FormData): { input?: PlanInput; error?: string } {
  const price = rupeesToPaise(String(formData.get("price") ?? ""));
  const perSeatPrice = rupeesToPaise(String(formData.get("perSeatPrice") ?? "0"));
  if (Number.isNaN(price) || Number.isNaN(perSeatPrice)) {
    return { error: "Prices must be valid non-negative amounts." };
  }
  const includedSeats = Number(String(formData.get("includedSeats") ?? "1"));
  if (!Number.isInteger(includedSeats) || includedSeats < 0) {
    return { error: "Included seats must be a whole number." };
  }
  const interval = String(formData.get("billingInterval") ?? "monthly");
  let features: Record<string, boolean>;
  try {
    features = parseFeatures(String(formData.get("features") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid features." };
  }
  return {
    input: {
      name: String(formData.get("name") ?? ""),
      price,
      currency: String(formData.get("currency") ?? "INR"),
      billingInterval: interval === "yearly" ? "yearly" : "monthly",
      includedSeats,
      perSeatPrice,
      features,
    },
  };
}

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { session } = await requireRole("access:superadmin");
  const { input, error } = readPlanInput(formData);
  if (error || !input) return { error: error ?? "Invalid input." };
  const result = await createPlanCore(input, session.user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/plans");
  redirect(`/superadmin/plans/${result.planId}`);
}

export async function updatePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { session } = await requireRole("access:superadmin");
  const planId = String(formData.get("planId") ?? "");
  const { input, error } = readPlanInput(formData);
  if (error || !input) return { error: error ?? "Invalid input." };
  const result = await updatePlanCore(planId, input, session.user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/superadmin/plans/${planId}`);
  revalidatePath("/superadmin/plans");
  return {};
}

export async function setPlanActiveAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const planId = String(formData.get("planId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  await setPlanActiveCore(planId, isActive, session.user.id);
  revalidatePath(`/superadmin/plans/${planId}`);
  revalidatePath("/superadmin/plans");
}
