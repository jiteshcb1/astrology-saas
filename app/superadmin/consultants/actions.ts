"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import {
  type ConsultantFormState,
  createConsultantCore,
  setOrgStatusCore,
  updateConsultantCore,
} from "@/lib/consultants";
import { assignPlanCore } from "@/lib/billing";

// Server actions are independently invokable POST endpoints, so each re-checks authorization —
// the layout guard alone is not sufficient.

export async function createConsultantAction(
  _prev: ConsultantFormState,
  formData: FormData,
): Promise<ConsultantFormState> {
  const { session } = await requireRole("access:superadmin");
  const result = await createConsultantCore(
    {
      orgName: String(formData.get("orgName") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      ownerEmail: String(formData.get("ownerEmail") ?? ""),
    },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/superadmin/consultants");
  redirect(`/superadmin/consultants/${result.orgId}`);
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
  const seatCount = Number(String(formData.get("seatCount") ?? "1"));
  const result = await assignPlanCore(orgId, planId, seatCount, session.user.id);
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
