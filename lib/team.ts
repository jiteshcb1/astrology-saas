import { randomBytes, createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantDb, tenantTransaction, findOrgInviteByTokenHash } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { normalizeEmail } from "@/lib/otp";
import { getBranding } from "@/lib/branding";
import { getSignedUrl } from "@/lib/storage";

// SP-5.1 Team member management. Owner-only mutations; per-seat gate; crypto invite tokens hashed at rest.

export type TeamRole = "team_consulting" | "team_accounts";
export const TEAM_ROLES: TeamRole[] = ["team_consulting", "team_accounts"];
export function isTeamRole(r: string): r is TeamRole {
  return r === "team_consulting" || r === "team_accounts";
}
export function roleLabel(role: string): string {
  if (role === "team_consulting") return "Consulting";
  if (role === "team_accounts") return "Accounts";
  if (role === "consultant") return "Owner";
  return role;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type TeamResult = { ok: true } | { ok: false; error: string };
export type TeamFormState = { error?: string; ok?: boolean };

async function isOwner(orgId: string, userId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerUserId: true } });
  return Boolean(org && org.ownerUserId === userId);
}

// ── Seat usage / gate ─────────────────────────────────────────────────────────
export interface SeatUsage {
  limit: number;
  usedActive: number;
  pendingCount: number;
  remaining: number;
}
export async function seatUsage(orgId: string): Promise<SeatUsage> {
  const [usedActive, pendingCount, sub] = await Promise.all([
    tenantDb(orgId).orgMember.count({ where: { status: "active", isBillableSeat: true } }),
    tenantDb(orgId).orgInvite.count({ where: { status: "pending", expiresAt: { gt: new Date() } } }),
    prisma.subscription.findUnique({ where: { orgId }, include: { plan: { select: { includedSeats: true } } } }),
  ]);
  const limit = sub?.seatCount ?? sub?.plan.includedSeats ?? 1;
  const remaining = Math.max(0, limit - usedActive - pendingCount);
  return { limit, usedActive, pendingCount, remaining };
}

// ── Listing ───────────────────────────────────────────────────────────────────
export type TeamMember = Prisma.OrgMemberGetPayload<{
  include: { user: { select: { id: true; name: true; email: true; image: true } } };
}>;

export async function listTeam(orgId: string) {
  const [org, membersRaw, invites] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { ownerUserId: true } }),
    tenantDb(orgId).orgMember.findMany({
      where: { status: "active" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    tenantDb(orgId).orgInvite.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" } }),
  ]);
  const members = membersRaw as TeamMember[];
  const now = Date.now();
  return {
    ownerUserId: org?.ownerUserId ?? null,
    members,
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role as string,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      expired: i.expiresAt.getTime() < now,
    })),
  };
}

// ── Invite ──────────────────────────────────────────────────────────────────--
export type InviteResult = { ok: true; inviteId: string; token: string } | { ok: false; error: string };

export async function inviteMemberCore(
  orgId: string,
  input: { email: string; role: string; message?: string },
  actorUserId: string,
): Promise<InviteResult> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (!isTeamRole(input.role)) return { ok: false, error: "Choose a role for this member." };
  const role: TeamRole = input.role;
  if (!(await isOwner(orgId, actorUserId))) return { ok: false, error: "Only the owner can invite members." };

  // Already an active member of this org?
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const member = await tenantDb(orgId).orgMember.findFirst({ where: { userId: existingUser.id, status: "active" } });
    if (member) return { ok: false, error: "That person is already on your team." };
  }

  const usage = await seatUsage(orgId);
  if (usage.remaining <= 0) {
    return { ok: false, error: `All ${usage.limit} seat${usage.limit === 1 ? "" : "s"} on your plan are in use. Remove a member or add seats to invite more.` };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const message = (input.message ?? "").trim().slice(0, 500) || null;
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const inviteId = await tenantTransaction(async ({ db, tenant }) => {
    // One live invite per email — supersede any existing pending one.
    await tenant(orgId).orgInvite.updateMany({ where: { email, status: "pending" }, data: { status: "cancelled" } });
    const invite = await tenant(orgId).orgInvite.create({
      data: { email, role, tokenHash, message, expiresAt, invitedByUserId: actorUserId, status: "pending" },
    });
    await writeAuditLog({ actorUserId, action: "team.invite", resourceType: "org_invite", resourceId: invite.id, orgId, metadata: { email, role } }, db);
    return invite.id;
  });
  return { ok: true, inviteId, token };
}

export type ResendResult =
  | { ok: true; inviteId: string; token: string; email: string; role: string; message: string | null }
  | { ok: false; error: string };

export async function resendInviteCore(orgId: string, inviteId: string, actorUserId: string): Promise<ResendResult> {
  if (!(await isOwner(orgId, actorUserId))) return { ok: false, error: "Only the owner can manage invites." };
  const invite = await tenantDb(orgId).orgInvite.findFirst({ where: { id: inviteId } });
  if (!invite) return { ok: false, error: "Invite not found." };
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).orgInvite.updateMany({ where: { id: inviteId }, data: { tokenHash, expiresAt, status: "pending" } });
    await writeAuditLog({ actorUserId, action: "team.invite_resend", resourceType: "org_invite", resourceId: inviteId, orgId }, db);
  });
  return { ok: true, inviteId, token, email: invite.email, role: invite.role as string, message: invite.message };
}

export async function cancelInviteCore(orgId: string, inviteId: string, actorUserId: string): Promise<TeamResult> {
  if (!(await isOwner(orgId, actorUserId))) return { ok: false, error: "Only the owner can manage invites." };
  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).orgInvite.updateMany({ where: { id: inviteId }, data: { status: "cancelled" } });
    await writeAuditLog({ actorUserId, action: "team.invite_cancel", resourceType: "org_invite", resourceId: inviteId, orgId }, db);
  });
  return { ok: true };
}

// ── Role change / removal ───────────────────────────────────────────────────--
export async function changeRoleCore(orgId: string, memberId: string, role: string, actorUserId: string): Promise<TeamResult> {
  if (!isTeamRole(role)) return { ok: false, error: "Invalid role." };
  if (!(await isOwner(orgId, actorUserId))) return { ok: false, error: "Only the owner can change roles." };
  const member = await tenantDb(orgId).orgMember.findFirst({ where: { id: memberId, status: "active" } });
  if (!member) return { ok: false, error: "Member not found." };
  if (member.role === "consultant") return { ok: false, error: "The owner's role can't be changed." };

  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).orgMember.updateMany({ where: { id: memberId }, data: { role } });
    await db.user.update({ where: { id: member.userId }, data: { role } }); // live RBAC reflects immediately
    await writeAuditLog({ actorUserId, action: "team.role_change", resourceType: "org_member", resourceId: memberId, orgId, metadata: { role } }, db);
  });
  return { ok: true };
}

export async function removeMemberCore(orgId: string, memberId: string, actorUserId: string): Promise<TeamResult> {
  if (!(await isOwner(orgId, actorUserId))) return { ok: false, error: "Only the owner can remove members." };
  const member = await tenantDb(orgId).orgMember.findFirst({ where: { id: memberId, status: "active" } });
  if (!member) return { ok: false, error: "Member not found." };
  if (member.role === "consultant") return { ok: false, error: "You can't remove the owner." };

  // Block if the member still hosts an upcoming booking (round-robin reassignment is SP-5.2/5.3).
  const upcoming = await tenantDb(orgId).booking.findFirst({
    where: { assignedMemberId: memberId, slot: { active: true, startsAt: { gt: new Date() } } },
  });
  if (upcoming) {
    return { ok: false, error: "This member has upcoming bookings. Reassign or cancel them before removing the member." };
  }

  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).orgMember.updateMany({ where: { id: memberId }, data: { status: "removed", isBillableSeat: false } });
    await db.user.update({ where: { id: member.userId }, data: { role: "seeker" } }); // revoke dashboard access
    await writeAuditLog({ actorUserId, action: "team.remove", resourceType: "org_member", resourceId: memberId, orgId, metadata: { role: member.role } }, db);
  });
  return { ok: true };
}

// ── Accept ─────────────────────────────────────────────────────────────────--
export type AcceptResult = { ok: true; orgId: string } | { ok: false; error: string };

export async function acceptInviteCore(token: string, userId: string): Promise<AcceptResult> {
  const invite = await findOrgInviteByTokenHash(hashInviteToken(token));
  if (!invite) return { ok: false, error: "This invite link is invalid." };
  const orgId = invite.organizationId;
  // Idempotent: the same user re-opening a consumed token (double-click) succeeds silently.
  if (invite.status === "accepted") {
    return invite.acceptedByUserId === userId ? { ok: true, orgId } : { ok: false, error: "This invite has already been accepted." };
  }
  if (invite.status !== "pending") return { ok: false, error: "This invite is no longer active." };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, error: "This invite has expired." };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) return { ok: false, error: "Sign in to accept this invite." };
  if (user.role === "consultant" || user.role === "super_admin") {
    return { ok: false, error: "This account can't join a team. Use a different account to accept." };
  }

  // Already a member? Idempotent success.
  const existing = await tenantDb(orgId).orgMember.findFirst({ where: { userId, status: "active" } });
  if (existing) {
    await tenantTransaction(async ({ tenant }) => {
      await tenant(orgId).orgInvite.updateMany({ where: { id: invite.id }, data: { status: "accepted", acceptedByUserId: userId } });
    });
    return { ok: true, orgId };
  }

  // Seat re-check (race with another accept/invite).
  const usage = await seatUsage(orgId);
  if (usage.usedActive >= usage.limit) return { ok: false, error: "This team has no seats available right now." };

  try {
    await tenantTransaction(async ({ db, tenant }) => {
      await tenant(orgId).orgMember.create({ data: { userId, role: invite.role, status: "active", isBillableSeat: true } });
      await db.user.update({ where: { id: userId }, data: { role: invite.role } });
      await tenant(orgId).orgInvite.updateMany({ where: { id: invite.id }, data: { status: "accepted", acceptedByUserId: userId } });
      await writeAuditLog({ actorUserId: userId, action: "team.accept", resourceType: "org_member", resourceId: invite.id, orgId, metadata: { role: invite.role } }, db);
    });
  } catch (e) {
    // Unique (userId, organizationId) collision → a concurrent accept already created the member. Idempotent.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true, orgId };
    throw e;
  }
  return { ok: true, orgId };
}

// ── Accept-page view (public, branded) ─────────────────────────────────────--
export type InviteState = "pending" | "expired" | "accepted" | "invalid";
export interface InviteView {
  state: InviteState;
  email: string;
  role: string;
  message: string | null;
  orgName: string;
  slug: string;
  themeColor: string | null;
  logoUrl: string | null;
  inviterName: string | null;
}

export async function getInviteByToken(token: string): Promise<InviteView | null> {
  const invite = await findOrgInviteByTokenHash(hashInviteToken(token));
  if (!invite) return null;

  let state: InviteState;
  if (invite.status === "accepted") state = "accepted";
  else if (invite.status !== "pending") state = "invalid";
  else if (invite.expiresAt.getTime() < Date.now()) state = "expired";
  else state = "pending";

  const org = await prisma.organization.findUnique({ where: { id: invite.organizationId }, select: { name: true, slug: true } });
  if (!org) return null;
  const branding = await getBranding(invite.organizationId);
  const logoUrl = branding?.logoKey ? await getSignedUrl(branding.logoKey) : null;
  const inviter = invite.invitedByUserId
    ? await prisma.user.findUnique({ where: { id: invite.invitedByUserId }, select: { name: true } })
    : null;

  return {
    state,
    email: invite.email,
    role: invite.role as string,
    message: invite.message,
    orgName: org.name,
    slug: org.slug,
    themeColor: branding?.themeColor ?? null,
    logoUrl,
    inviterName: inviter?.name ?? null,
  };
}
