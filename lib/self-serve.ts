import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantTransaction, findActiveMembershipByUser } from "@/lib/tenant-db";
import { slugAvailabilityCore } from "@/lib/consultants";
import { evaluateSlugInput, normalizeSlug, validateSlug } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";

// SP-7.1 — self-serve consultant provisioning. The app is astrologer-only (not a marketplace): anyone who
// signs in IS a consultant, so a brand-new user with no org gets a solo Organization on the free Starter plan.
// Atomic (one transaction), idempotent (never a 2nd org), audit-logged, rate-limited, reserved-slug-safe.

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_IP_PER_HOUR = 5;
const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_SLUG_BASE = 34; // leave room for a "-NN" suffix within the 40-char slug limit

export type ProvisionResult =
  | { ok: true; orgId: string; created: boolean }
  | { ok: false; reason: "rate_limited" | "error" };

export interface ProvisionInput {
  claimSlug?: string | null;
  ip?: string | null;
  displayName?: string | null;
  email?: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// A valid, non-reserved base slug derived from the user's name (preferred) or email local-part.
// Falls back to "consultant" when nothing usable is available.
function baseSlugFrom(displayName?: string | null, email?: string | null): string {
  const candidates: string[] = [];
  if (displayName) candidates.push(evaluateSlugInput(displayName).canonical);
  if (email) candidates.push(evaluateSlugInput(email.split("@")[0] ?? "").canonical);
  for (const c of candidates) {
    const sliced = c.slice(0, MAX_SLUG_BASE);
    if (sliced.length >= 3 && validateSlug(sliced).ok) return sliced;
  }
  return "consultant";
}

// Try base, base-2, base-3 … until an available (valid + untaken) slug is found.
async function generateUniqueSlug(base: string): Promise<string> {
  for (let i = 1; i < 60; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if ((await slugAvailabilityCore(candidate)).available) return candidate;
  }
  // Extremely unlikely fallback — a short stable-ish suffix.
  return `${base.slice(0, 30)}-${Math.abs(hashStr(base)) % 9999}`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function rateLimited(ip: string | null, email: string | null): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const [ipCount, emailCount] = await Promise.all([
    ip ? prisma.signupAttempt.count({ where: { requestIp: ip, createdAt: { gt: since } } }) : Promise.resolve(0),
    email ? prisma.signupAttempt.count({ where: { email, createdAt: { gt: since } } }) : Promise.resolve(0),
  ]);
  return (!!ip && ipCount >= MAX_PER_IP_PER_HOUR) || (!!email && emailCount >= MAX_PER_EMAIL_PER_HOUR);
}

// The atomic org-creation transaction (mirrors lib/consultants.ts createConsultantCore, free-plan variant).
async function createOrgTx(
  userId: string,
  slug: string,
  orgName: string,
  plan: { id: string; includedSeats: number } | null,
  meta: { usedClaim: boolean; ip: string | null },
): Promise<string> {
  return tenantTransaction(async ({ db, tenant }) => {
    // Elevate a seeker to consultant; never demote a higher role (e.g. an existing team member edge case).
    const u = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (u?.role === "seeker") {
      await db.user.update({ where: { id: userId }, data: { role: "consultant" } });
    }
    const org = await db.organization.create({
      data: { name: orgName, slug, ownerUserId: userId, status: "active", source: "self_serve" },
    });
    // Owner = 1 active billable seat. Reachable ONLY via the scoped facade.
    await tenant(org.id).orgMember.create({
      data: { userId, role: "consultant", status: "active", isBillableSeat: true },
    });
    if (plan) {
      // Free Starter: no gateway call, immediately active. purchasedSeats seeds the team-invite gate.
      await db.subscription.create({
        data: { orgId: org.id, planId: plan.id, seatCount: 1, purchasedSeats: plan.includedSeats, status: "active" },
      });
    }
    await writeAuditLog(
      {
        actorUserId: userId,
        action: "org.self_serve_created",
        resourceType: "organization",
        resourceId: org.id,
        orgId: org.id,
        metadata: { slug, usedClaim: meta.usedClaim, planId: plan?.id ?? null, ip: meta.ip },
      },
      db,
    );
    return org.id;
  });
}

export async function provisionSelfServeOrgCore(userId: string, input: ProvisionInput = {}): Promise<ProvisionResult> {
  // 1. Idempotent — if they already belong to an org, never create a second one.
  const existing = await findActiveMembershipByUser(userId);
  if (existing) return { ok: true, orgId: existing.organizationId, created: false };

  const email = input.email ? input.email.trim().toLowerCase() : null;
  const ip = input.ip ?? null;

  // 2. Rate limit (DB-counted, per IP + per email / hour), then record this attempt.
  if (await rateLimited(ip, email)) return { ok: false, reason: "rate_limited" };
  await prisma.signupAttempt.create({ data: { email: email ?? "", requestIp: ip } });

  // 3. Slug: prefer a valid + available claim from the marketing field, else generate from name/email.
  let slug: string | null = null;
  let usedClaim = false;
  if (input.claimSlug) {
    const norm = normalizeSlug(input.claimSlug);
    if ((await slugAvailabilityCore(norm)).available) {
      slug = norm;
      usedClaim = true;
    }
  }
  if (!slug) slug = await generateUniqueSlug(baseSlugFrom(input.displayName, email));

  // 4. Free Starter plan (robust to renames: cheapest active price-0 plan).
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true, price: 0 },
    orderBy: { includedSeats: "asc" },
    select: { id: true, includedSeats: true },
  });

  const orgName = input.displayName?.trim() ? `${input.displayName.trim()}'s Practice` : "My Practice";

  // 5. Create atomically; on a slug race (P2002) regenerate and retry exactly once.
  try {
    const orgId = await createOrgTx(userId, slug, orgName, plan, { usedClaim, ip });
    return { ok: true, orgId, created: true };
  } catch (e) {
    if (!isUniqueViolation(e)) return { ok: false, reason: "error" };
    try {
      const retrySlug = await generateUniqueSlug(baseSlugFrom(input.displayName, email));
      const orgId = await createOrgTx(userId, retrySlug, orgName, plan, { usedClaim: false, ip });
      return { ok: true, orgId, created: true };
    } catch {
      return { ok: false, reason: "error" };
    }
  }
}
