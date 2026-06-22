import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/otp";
import { normalizeSlug, validateSlug } from "@/lib/slug";
import { env } from "@/lib/env";

// Business logic for the Super Admin Consultants module. Kept free of "use server"/redirect so it
// is unit-testable; the server actions in app/superadmin/consultants/actions.ts are thin wrappers
// that enforce requireRole() and handle redirects.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ConsultantFormState = { error?: string };

export interface CreateConsultantInput {
  orgName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
}

export type CreateConsultantResult = { ok: true; orgId: string } | { ok: false; error: string };
export type MutationResult = { ok: true } | { ok: false; error: string };

export async function createConsultantCore(
  input: CreateConsultantInput,
  actorUserId: string,
): Promise<CreateConsultantResult> {
  const orgName = input.orgName.trim();
  const ownerName = input.ownerName.trim();
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const slug = normalizeSlug(input.slug);

  if (!orgName) return { ok: false, error: "Organization name is required." };
  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) return { ok: false, error: slugCheck.error };
  if (!EMAIL_RE.test(ownerEmail)) return { ok: false, error: "Enter a valid owner email." };

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return { ok: false, error: "That slug is already taken." };

  let orgId: string;
  try {
    orgId = await tenantTransaction(async ({ db, tenant }) => {
      // Provision the owner user; elevate a seeker to consultant but never demote another role.
      const found = await db.user.findUnique({
        where: { email: ownerEmail },
        select: { id: true, role: true },
      });
      let userId: string;
      if (found) {
        userId = found.id;
        if (found.role === "seeker") {
          await db.user.update({
            where: { id: userId },
            data: { role: "consultant", name: ownerName || undefined },
          });
        }
      } else {
        const created = await db.user.create({
          data: { email: ownerEmail, name: ownerName || undefined, role: "consultant" },
        });
        userId = created.id;
      }

      const org = await db.organization.create({
        data: { name: orgName, slug, ownerUserId: userId, status: "active" },
      });

      // Reachable ONLY via the scoped facade — db.orgMember would throw.
      await tenant(org.id).orgMember.create({
        data: { userId, role: "consultant", status: "active", isBillableSeat: true },
      });

      await writeAuditLog(
        {
          actorUserId,
          action: "org.create",
          resourceType: "organization",
          resourceId: org.id,
          orgId: org.id,
          metadata: { slug, ownerEmail },
        },
        db,
      );

      return org.id;
    });
  } catch {
    return { ok: false, error: "Could not create consultant (slug or email conflict)." };
  }

  // Invite email (stubbed by lib/email when RESEND_API_KEY is empty) — after commit.
  await sendEmail({
    to: ownerEmail,
    subject: "You've been added to Astro Consultancy",
    text: `An account was created for "${orgName}". Sign in at ${env.AUTH_URL}/signin to get started.`,
  });

  return { ok: true, orgId };
}

export async function updateConsultantCore(
  orgId: string,
  input: { orgName: string },
  actorUserId: string,
): Promise<MutationResult> {
  const name = input.orgName.trim();
  if (!name) return { ok: false, error: "Organization name is required." };
  // Slug is intentionally NOT editable in Phase 1 (immutable public URL).
  await tenantTransaction(async ({ db }) => {
    await db.organization.update({ where: { id: orgId }, data: { name } });
    await writeAuditLog(
      {
        actorUserId,
        action: "org.update",
        resourceType: "organization",
        resourceId: orgId,
        orgId,
        metadata: { name },
      },
      db,
    );
  });
  return { ok: true };
}

export async function setOrgStatusCore(
  orgId: string,
  status: "active" | "suspended",
  actorUserId: string,
): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    await db.organization.update({ where: { id: orgId }, data: { status } });
    await writeAuditLog(
      {
        actorUserId,
        action: status === "suspended" ? "org.suspend" : "org.reactivate",
        resourceType: "organization",
        resourceId: orgId,
        orgId,
      },
      db,
    );
  });
}
