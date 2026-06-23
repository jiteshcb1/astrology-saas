"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import {
  type ConsultantFormState,
  createConsultantCore,
  deleteConsultantCore,
  setOrgStatusCore,
  slugAvailabilityCore,
  updateConsultantCore,
} from "@/lib/consultants";
import { assignPlanByAdditionalSeatsCore } from "@/lib/billing";

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean; reason?: string }> {
  await requireRole("access:superadmin");
  return slugAvailabilityCore(slug);
}

// Server actions are independently invokable POST endpoints, so each re-checks authorization —
// the layout guard alone is not sufficient.

// Combined create flow (wizard): provision the consultant, then optionally assign a plan by
// additional seats. If the plan step fails, the org still exists and a plan can be assigned later.
export async function createConsultantWithPlanAction(
  _prev: ConsultantFormState,
  formData: FormData,
): Promise<ConsultantFormState> {
  const { session } = await requireRole("access:superadmin");
  const created = await createConsultantCore(
    {
      orgName: String(formData.get("orgName") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      ownerEmail: String(formData.get("ownerEmail") ?? ""),
    },
    session.user.id,
  );
  if (!created.ok) return { error: created.error };

  const planId = String(formData.get("planId") ?? "");
  if (planId) {
    const additionalSeats = Number(String(formData.get("additionalSeats") ?? "0")) || 0;
    await assignPlanByAdditionalSeatsCore(created.orgId, planId, additionalSeats, session.user.id);
  }
  revalidatePath("/superadmin/consultants");
  redirect(`/superadmin/consultants/${created.orgId}`);
}

export async function deleteConsultantAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const orgId = String(formData.get("orgId") ?? "");
  const result = await deleteConsultantCore(orgId, session.user.id);
  revalidatePath("/superadmin/consultants");
  if (!result.ok) {
    redirect(`/superadmin/consultants/${orgId}?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/superadmin/consultants");
}

export async function updateConsultantAction(
  _prev: ConsultantFormState,
  formData: FormData,
): Promise<ConsultantFormState> {
  const { session } = await requireRole("access:superadmin");
  const orgId = String(formData.get("orgId") ?? "");
  const result = await updateConsultantCore(
    orgId,
    { orgName: String(formData.get("orgName") ?? "") },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath(`/superadmin/consultants/${orgId}`);
  return {};
}

export async function assignPlanAction(
  _prev: ConsultantFormState,
  formData: FormData,
): Promise<ConsultantFormState> {
  const { session } = await requireRole("access:superadmin");
  const orgId = String(formData.get("orgId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const additionalSeats = Number(String(formData.get("additionalSeats") ?? "0")) || 0;
  const result = await assignPlanByAdditionalSeatsCore(orgId, planId, additionalSeats, session.user.id);
  if (!result.ok) return { error: result.error };
  revalidatePath(`/superadmin/consultants/${orgId}`);
  revalidatePath("/superadmin/consultants");
  return {};
}

export async function setOrgStatusAction(formData: FormData): Promise<void> {
  const { session } = await requireRole("access:superadmin");
  const orgId = String(formData.get("orgId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "suspended") return;
  await setOrgStatusCore(orgId, status, session.user.id);
  revalidatePath(`/superadmin/consultants/${orgId}`);
  revalidatePath("/superadmin/consultants");
}
