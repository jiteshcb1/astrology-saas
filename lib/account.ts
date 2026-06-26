import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// SP-5.3: a team member's own account identity (User.name + User.phone). No org/profile data — that's the
// owner's domain. (No per-member ConsultantProfile; round-robin hides host identity from seekers.)

export type AccountResult = { ok: true } | { ok: false; error: string };
export type AccountFormState = { error?: string; ok?: boolean };

export async function getMyAccount(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true, email: true } });
}

export async function updateMyAccountCore(userId: string, input: { name: string; phone: string }): Promise<AccountResult> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) return { ok: false, error: "Enter your name." };
  if (name.length > 120) return { ok: false, error: "That name is too long." };
  if (phone && !/^[+0-9 ()-]{6,20}$/.test(phone)) return { ok: false, error: "Enter a valid phone number." };
  await prisma.user.update({ where: { id: userId }, data: { name, phone: phone || null } });
  await writeAuditLog({ actorUserId: userId, action: "account.update", resourceType: "user", resourceId: userId });
  return { ok: true };
}
