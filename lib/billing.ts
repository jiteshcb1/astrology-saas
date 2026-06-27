import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { getBillingGateway } from "@/lib/gateway";
import { computeEffectivePrice } from "@/lib/money";
import { totalSeatCount } from "@/lib/checkout";

// Super Admin plan/subscription cores. The pure money helpers now live in lib/money.ts (client-safe)
// and are re-exported here so existing imports keep working. Cores are free of "use server"/redirect
// so they're unit-testable; server actions are thin wrappers.
export { computeEffectivePrice, formatMoney, parseFeatures } from "@/lib/money";

// SP-6.1 — active subscription plans for the PUBLIC pricing page, cheapest first. Plans are platform-level
// (global, not tenant-scoped), so a bare prisma read is correct here.
export function listPublicPlans() {
  return prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: "asc" } });
}

// ── Cores ─────────────────────────────────────────────────────────────────────

export interface PlanInput {
  name: string;
  price: number; // paise
  currency: string;
  billingInterval: "monthly" | "yearly";
  includedSeats: number;
  perSeatPrice: number; // paise
  features: Record<string, boolean>;
}

export type PlanResult = { ok: true; planId: string } | { ok: false; error: string };
export type BillingMutationResult = { ok: true } | { ok: false; error: string };
export type PlanFormState = { error?: string };

function validatePlan(input: PlanInput): string | null {
  if (!input.name.trim()) return "Plan name is required.";
  if (!Number.isInteger(input.price) || input.price < 0)
    return "Base price must be a non-negative whole number of paise.";
  if (!Number.isInteger(input.perSeatPrice) || input.perSeatPrice < 0)
    return "Per-seat price must be a non-negative whole number of paise.";
  if (!Number.isInteger(input.includedSeats) || input.includedSeats < 0)
    return "Included seats must be a non-negative whole number.";
  if (input.billingInterval !== "monthly" && input.billingInterval !== "yearly")
    return "Invalid billing interval.";
  if (!input.currency.trim()) return "Currency is required.";
  return null;
}

function planData(input: PlanInput) {
  return {
    name: input.name.trim(),
    price: input.price,
    currency: input.currency.trim().toUpperCase(),
    billingInterval: input.billingInterval,
    includedSeats: input.includedSeats,
    perSeatPrice: input.perSeatPrice,
    features: input.features,
  };
}

export async function createPlanCore(input: PlanInput, actorUserId: string): Promise<PlanResult> {
  const err = validatePlan(input);
  if (err) return { ok: false, error: err };
  const planId = await tenantTransaction(async ({ db }) => {
    const plan = await db.subscriptionPlan.create({ data: planData(input) });
    await writeAuditLog(
      {
        actorUserId,
        action: "plan.create",
        resourceType: "subscription_plan",
        resourceId: plan.id,
        metadata: { name: plan.name, price: plan.price, currency: plan.currency },
      },
      db,
    );
    return plan.id;
  });
  return { ok: true, planId };
}

export async function updatePlanCore(
  planId: string,
  input: PlanInput,
  actorUserId: string,
): Promise<BillingMutationResult> {
  const err = validatePlan(input);
  if (err) return { ok: false, error: err };
  await tenantTransaction(async ({ db }) => {
    await db.subscriptionPlan.update({ where: { id: planId }, data: planData(input) });
    await writeAuditLog(
      {
        actorUserId,
        action: "plan.update",
        resourceType: "subscription_plan",
        resourceId: planId,
        metadata: { name: input.name.trim() },
      },
      db,
    );
  });
  return { ok: true };
}

export async function setPlanActiveCore(
  planId: string,
  isActive: boolean,
  actorUserId: string,
): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    await db.subscriptionPlan.update({ where: { id: planId }, data: { isActive } });
    await writeAuditLog(
      {
        actorUserId,
        action: "plan.update",
        resourceType: "subscription_plan",
        resourceId: planId,
        metadata: { isActive },
      },
      db,
    );
  });
}

// Delete a plan — BLOCKED if any subscription references it, or any plan-scoped feature flag points
// at it (no FK, would orphan). Clear message in either case.
export async function deletePlanCore(
  planId: string,
  actorUserId: string,
): Promise<BillingMutationResult> {
  const subCount = await prisma.subscription.count({ where: { planId } });
  if (subCount > 0) {
    return {
      ok: false,
      error: `This plan is assigned to ${subCount} consultant(s). Reassign them before deleting.`,
    };
  }
  const flagCount = await prisma.featureFlag.count({ where: { scope: "plan", scopeId: planId } });
  if (flagCount > 0) {
    return {
      ok: false,
      error: `This plan has ${flagCount} plan-scoped feature flag(s). Remove them before deleting.`,
    };
  }
  await tenantTransaction(async ({ db }) => {
    await db.subscriptionPlan.delete({ where: { id: planId } });
    await writeAuditLog(
      { actorUserId, action: "plan.delete", resourceType: "subscription_plan", resourceId: planId },
      db,
    );
  });
  return { ok: true };
}

// Assign by ADDITIONAL seats (the operator-facing field). Maps to the TOTAL seat count
// (includedSeats + additionalSeats) that assignPlanCore / computeEffectivePrice expect.
export async function assignPlanByAdditionalSeatsCore(
  orgId: string,
  planId: string,
  additionalSeats: number,
  actorUserId: string,
): Promise<BillingMutationResult> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return { ok: false, error: "Plan not found." };
  return assignPlanCore(orgId, planId, totalSeatCount(plan.includedSeats, additionalSeats), actorUserId);
}

export async function assignPlanCore(
  orgId: string,
  planId: string,
  seatCount: number,
  actorUserId: string,
): Promise<BillingMutationResult> {
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return { ok: false, error: "Seat count must be a whole number of at least 1." };
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return { ok: false, error: "Plan not found." };
  if (!plan.isActive) return { ok: false, error: "Cannot assign an inactive plan." };

  const effectivePrice = computeEffectivePrice(plan, seatCount);

  // Create the gateway subscription BEFORE the DB transaction (no external call while a tx is open).
  // Reuse the existing gateway ref if the org already has one.
  const existing = await prisma.subscription.findUnique({
    where: { orgId },
    select: { gatewaySubscriptionRef: true, currentPeriodEnd: true },
  });
  let gatewaySubscriptionRef = existing?.gatewaySubscriptionRef ?? null;
  let currentPeriodEnd = existing?.currentPeriodEnd ?? null;
  if (!gatewaySubscriptionRef) {
    const created = await getBillingGateway().createSubscription({
      orgId,
      planId,
      seatCount,
      amount: effectivePrice,
      currency: plan.currency,
      interval: plan.billingInterval,
    });
    gatewaySubscriptionRef = created.gatewaySubscriptionRef;
    currentPeriodEnd = created.currentPeriodEnd;
  }

  await tenantTransaction(async ({ db }) => {
    // The admin-entered seatCount is the AUTHORIZED capacity (includedSeats + additional) → purchasedSeats.
    // seatCount itself is seeded here and then auto-corrected to actual billable members by lib/seats.ts.
    await db.subscription.upsert({
      where: { orgId },
      create: { orgId, planId, seatCount, purchasedSeats: seatCount, status: "active", gatewaySubscriptionRef, currentPeriodEnd },
      update: { planId, seatCount, purchasedSeats: seatCount, status: "active", gatewaySubscriptionRef, currentPeriodEnd },
    });
    await writeAuditLog(
      {
        actorUserId,
        action: "subscription.assign",
        resourceType: "subscription",
        resourceId: orgId,
        orgId,
        metadata: { planId, seatCount, effectivePrice, gatewaySubscriptionRef },
      },
      db,
    );
  });
  return { ok: true };
}
