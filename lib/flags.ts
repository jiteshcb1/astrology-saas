import type { FlagScope } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";

// Feature flags (config-as-data). Resolution precedence: org > plan > global > false.
// Platform-level (super-admin managed); the resolver reads via explicit scope/scopeId filters.
// Mutations go through tenantTransaction + writeAuditLog. Cores are free of "use server"/redirect.

const FLAG_KEY_RE = /^[a-z0-9][a-z0-9_.-]{1,48}[a-z0-9]$/;

export type FlagFormState = { error?: string };
export type FlagResult = { ok: true } | { ok: false; error: string };

export interface SetFlagInput {
  key: string;
  scope: FlagScope;
  scopeId: string | null;
  enabled: boolean;
}

// ── Pure precedence (exhaustively unit-tested) ──────────────────────────────────
// Returns the first DEFINED layer in order org → plan → global; absent everywhere ⇒ false.
// A `false` at a higher layer therefore overrides a `true` below it.
export function resolveFlag(layers: { org?: boolean; plan?: boolean; global?: boolean }): boolean {
  if (layers.org !== undefined) return layers.org;
  if (layers.plan !== undefined) return layers.plan;
  if (layers.global !== undefined) return layers.global;
  return false;
}

async function planIdForOrg(orgId: string): Promise<string | null> {
  const sub = await prisma.subscription.findUnique({ where: { orgId }, select: { planId: true } });
  return sub?.planId ?? null;
}

export async function isFeatureEnabled(key: string, orgId?: string | null): Promise<boolean> {
  const layers: { org?: boolean; plan?: boolean; global?: boolean } = {};

  if (orgId) {
    const orgFlag = await prisma.featureFlag.findFirst({
      where: { key, scope: "org", scopeId: orgId },
    });
    if (orgFlag) layers.org = orgFlag.enabled;

    const planId = await planIdForOrg(orgId);
    if (planId) {
      const planFlag = await prisma.featureFlag.findFirst({
        where: { key, scope: "plan", scopeId: planId },
      });
      if (planFlag) layers.plan = planFlag.enabled;
    }
  }

  const globalFlag = await prisma.featureFlag.findFirst({
    where: { key, scope: "global", scopeId: null },
  });
  if (globalFlag) layers.global = globalFlag.enabled;

  return resolveFlag(layers);
}

// Resolve every key relevant to the org into a map (for the client FeatureProvider).
export async function resolveFeatures(orgId?: string | null): Promise<Record<string, boolean>> {
  const keys = new Set<string>();
  (await prisma.featureFlag.findMany({ where: { scope: "global", scopeId: null } })).forEach((f) =>
    keys.add(f.key),
  );
  if (orgId) {
    (await prisma.featureFlag.findMany({ where: { scope: "org", scopeId: orgId } })).forEach((f) =>
      keys.add(f.key),
    );
    const planId = await planIdForOrg(orgId);
    if (planId) {
      (await prisma.featureFlag.findMany({ where: { scope: "plan", scopeId: planId } })).forEach(
        (f) => keys.add(f.key),
      );
    }
  }
  const out: Record<string, boolean> = {};
  for (const key of keys) out[key] = await isFeatureEnabled(key, orgId);
  return out;
}

// ── Cores ───────────────────────────────────────────────────────────────────────

async function resolveScopeId(scope: FlagScope, scopeId: string | null): Promise<FlagResult & { value?: string | null }> {
  if (scope === "global") return { ok: true, value: null };
  if (!scopeId) return { ok: false, error: scope === "plan" ? "Select a plan." : "Select a consultant org." };
  if (scope === "plan") {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: scopeId } });
    if (!plan) return { ok: false, error: "Plan not found." };
    return { ok: true, value: plan.id };
  }
  const org = await prisma.organization.findUnique({ where: { id: scopeId } });
  if (!org) return { ok: false, error: "Organization not found." };
  return { ok: true, value: org.id };
}

export async function setFlagCore(input: SetFlagInput, actorUserId: string): Promise<FlagResult> {
  const key = input.key.trim().toLowerCase();
  if (!FLAG_KEY_RE.test(key)) {
    return {
      ok: false,
      error: "Key must be 3–50 chars: lowercase letters, digits, '.', '_' or '-', not starting/ending with a separator.",
    };
  }
  const resolved = await resolveScopeId(input.scope, input.scopeId);
  if (!resolved.ok) return resolved;
  const scopeId = resolved.value ?? null;

  await tenantTransaction(async ({ db }) => {
    const existing = await db.featureFlag.findFirst({ where: { key, scope: input.scope, scopeId } });
    if (existing) {
      await db.featureFlag.update({ where: { id: existing.id }, data: { enabled: input.enabled } });
    } else {
      await db.featureFlag.create({ data: { key, scope: input.scope, scopeId, enabled: input.enabled } });
    }
    await writeAuditLog(
      {
        actorUserId,
        action: "flag.set",
        resourceType: "feature_flag",
        resourceId: `${key}:${input.scope}:${scopeId ?? "global"}`,
        orgId: input.scope === "org" ? scopeId : null,
        metadata: { key, scope: input.scope, scopeId, enabled: input.enabled },
      },
      db,
    );
  });
  return { ok: true };
}

export async function setFlagEnabledCore(
  id: string,
  enabled: boolean,
  actorUserId: string,
): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    const flag = await db.featureFlag.update({ where: { id }, data: { enabled } });
    await writeAuditLog(
      {
        actorUserId,
        action: "flag.set",
        resourceType: "feature_flag",
        resourceId: id,
        orgId: flag.scope === "org" ? flag.scopeId : null,
        metadata: { key: flag.key, scope: flag.scope, scopeId: flag.scopeId, enabled },
      },
      db,
    );
  });
}

export async function deleteFlagCore(id: string, actorUserId: string): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    const flag = await db.featureFlag.delete({ where: { id } });
    await writeAuditLog(
      {
        actorUserId,
        action: "flag.delete",
        resourceType: "feature_flag",
        resourceId: id,
        orgId: flag.scope === "org" ? flag.scopeId : null,
        metadata: { key: flag.key, scope: flag.scope, scopeId: flag.scopeId },
      },
      db,
    );
  });
}
