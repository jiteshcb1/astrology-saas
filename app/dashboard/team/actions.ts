"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrgOwner } from "@/lib/rbac";
import {
  inviteMemberCore,
  resendInviteCore,
  cancelInviteCore,
  changeRoleCore,
  removeMemberCore,
  roleLabel,
  type TeamFormState,
} from "@/lib/team";
import { notifyOrgInvite } from "@/lib/notifications";

const BASE = env.AUTH_URL.replace(/\/$/, "");

async function sendInviteEmail(orgId: string, inviteId: string, token: string, email: string, role: string, message?: string | null) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } });
  if (!org) return;
  await notifyOrgInvite({ orgId, email, roleLabel: roleLabel(role), message, inviteUrl: `${BASE}/${org.slug}/invite/${token}` });
}

export async function inviteMemberAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { session, orgId } = await requireOrgOwner();
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "");
  const message = String(formData.get("message") ?? "");
  const result = await inviteMemberCore(orgId, { email, role, message }, session.user.id);
  if (!result.ok) return { error: result.error };
  await sendInviteEmail(orgId, result.inviteId, result.token, email, role, message);
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  const { session, orgId } = await requireOrgOwner();
  const inviteId = String(formData.get("inviteId") ?? "");
  const result = await resendInviteCore(orgId, inviteId, session.user.id);
  if (result.ok) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { slug: true } });
    if (org) await notifyOrgInvite({ orgId, email: result.email, roleLabel: roleLabel(result.role), message: result.message, inviteUrl: `${BASE}/${org.slug}/invite/${result.token}` });
  }
  revalidatePath("/dashboard/team");
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const { session, orgId } = await requireOrgOwner();
  await cancelInviteCore(orgId, String(formData.get("inviteId") ?? ""), session.user.id);
  revalidatePath("/dashboard/team");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const { session, orgId } = await requireOrgOwner();
  await changeRoleCore(orgId, String(formData.get("memberId") ?? ""), String(formData.get("role") ?? ""), session.user.id);
  revalidatePath("/dashboard/team");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const { session, orgId } = await requireOrgOwner();
  await removeMemberCore(orgId, String(formData.get("memberId") ?? ""), session.user.id);
  revalidatePath("/dashboard/team");
}
