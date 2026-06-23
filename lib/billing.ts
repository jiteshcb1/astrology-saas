import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { getBillingGateway } from "@/lib/gateway";

// Billing math + Super Admin plan/subscription cores. All money is integer paise; the payable
// amount is always computed (never stored) so there is one source of truth. Cores are free of
// "use server"/redirect so they're unit-testable; server actions are thin wrappers.

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function computeEffectivePrice(
  plan: Pick<SubscriptionPlan, "price" | "includedSeats" | "perSeatPrice">,
  seatCount: number,
): number {
  const extraSeats = Math.max(0, Math.trunc(seatCount) - plan.includedSeats);
  return plan.price + extraSeats * plan.perSeatPrice;
}

export function formatMoney(paise: number, currency = "INR"): string {
  const major = paise / 100;
  const amount = major.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "INR" ? `₹${amount}` : `${currency} ${amount}`;
}

export function parseFeatures(raw: string): Record<string, boolean> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Features must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Features must be a JSON object of key → true/false.");
  }
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "boolean") throw new Error(`Feature "${key}" must be true or false.`);
    out[key] = value;
  }
  return out;
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
    await db.subscription.upsert({
      where: { orgId },
      create: { orgId, planId, seatCount, status: "active", gatewaySubscriptionRef, currentPeriodEnd },
      update: { planId, seatCount, status: "active", gatewaySubscriptionRef, currentPeriodEnd },
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
