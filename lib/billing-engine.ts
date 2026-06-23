import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { applyOrgStatus } from "@/lib/consultants";
import { computeEffectivePrice } from "@/lib/billing";
import { renderSubscriptionReceiptPdf } from "@/lib/pdf";
import { putObject } from "@/lib/storage";
import { env } from "@/lib/env";
import type { GatewayWebhookEvent } from "@/lib/gateway";

// The grace window between a failed charge (past_due) and suspending the org's public page.
export const GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export interface ApplyResult {
  ok: boolean;
  duplicate?: boolean; // replay → no-op
  ignored?: boolean; // no matching subscription
}

// Idempotent, signature-verified-upstream webhook application. The billing_events unique insert is
// the dedup guarantee: a replay collides and the whole transaction rolls back (nothing re-applied).
export async function applyWebhookEvent(event: GatewayWebhookEvent): Promise<ApplyResult> {
  const sub = await prisma.subscription.findFirst({
    where: { gatewaySubscriptionRef: event.subscriptionRef },
    include: { organization: true, plan: true },
  });
  if (!sub) return { ok: true, ignored: true };

  // For a charge, prepare the receipt PDF + upload OUTSIDE the transaction (no external IO while a
  // tx is held). Deterministic key by event id → a replay re-uploads the same object harmlessly.
  let receiptPlan: {
    pdfUrl: string;
    amount: number;
    currency: string;
    issuedTo: string;
    receiptNumber: string;
  } | null = null;
  if (event.type === "subscription.charged") {
    const amount = event.amount ?? computeEffectivePrice(sub.plan, sub.seatCount);
    const currency = event.currency ?? sub.plan.currency;
    const receiptNumber = `SUB-${event.id}`;
    const issuedAt = new Date();
    const pdf = await renderSubscriptionReceiptPdf({
      receiptNumber,
      orgName: sub.organization.name,
      issuedTo: sub.organization.name,
      gstNumber: env.PLATFORM_GST_NUMBER,
      legalName: env.PLATFORM_LEGAL_NAME,
      amount,
      currency,
      periodEnd: sub.currentPeriodEnd,
      issuedAt,
    });
    const key = `receipts/${sub.orgId}/${receiptNumber}.pdf`;
    await putObject({ key, body: pdf, contentType: "application/pdf" });
    receiptPlan = { pdfUrl: key, amount, currency, issuedTo: sub.organization.name, receiptNumber };
  }

  try {
    await tenantTransaction(async ({ db, tenant }) => {
      // Dedup ledger — a replay throws P2002 here and rolls the whole tx back.
      await db.billingEvent.create({
        data: { gatewayEventId: event.id, type: event.type, payload: event as unknown as Prisma.InputJsonValue },
      });

      if (event.type === "subscription.charged" && receiptPlan) {
        const days = sub.plan.billingInterval === "yearly" ? 365 : 30;
        const computedEnd = new Date(Date.now() + days * DAY_MS);
        // Never move the period end backwards for a stale, out-of-order event.
        const currentPeriodEnd =
          sub.currentPeriodEnd && sub.currentPeriodEnd > computedEnd ? sub.currentPeriodEnd : computedEnd;

        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "active", currentPeriodEnd, pastDueSince: null, suspendedForNonpayment: false },
        });

        await tenant(sub.orgId).receipt.create({
          data: {
            type: "subscription",
            issuedTo: receiptPlan.issuedTo,
            gstNumberUsed: env.PLATFORM_GST_NUMBER || null,
            amount: receiptPlan.amount,
            currency: receiptPlan.currency,
            pdfUrl: receiptPlan.pdfUrl,
          },
        });

        // Recovery: reactivate ONLY if WE suspended for non-payment (never a manual suspend).
        if (sub.suspendedForNonpayment) {
          await applyOrgStatus(db, sub.orgId, "active", null, { reason: "subscription_recovered" });
        }

        await writeAuditLog(
          {
            actorUserId: null,
            action: "subscription.charged",
            resourceType: "subscription",
            resourceId: sub.id,
            orgId: sub.orgId,
            metadata: { amount: receiptPlan.amount, currency: receiptPlan.currency, receiptNumber: receiptPlan.receiptNumber },
          },
          db,
        );
      } else if (event.type === "subscription.payment_failed") {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "past_due", pastDueSince: sub.pastDueSince ?? new Date() },
        });
        await writeAuditLog(
          {
            actorUserId: null,
            action: "subscription.payment_failed",
            resourceType: "subscription",
            resourceId: sub.id,
            orgId: sub.orgId,
          },
          db,
        );
      } else if (event.type === "subscription.canceled") {
        await db.subscription.update({ where: { id: sub.id }, data: { status: "canceled" } });
        await writeAuditLog(
          {
            actorUserId: null,
            action: "subscription.canceled",
            resourceType: "subscription",
            resourceId: sub.id,
            orgId: sub.orgId,
          },
          db,
        );
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, duplicate: true };
    throw e;
  }

  return { ok: true };
}

// Dunning sweep (invoked by the secured cron route). Suspends orgs whose grace window has elapsed,
// via the SAME organizations.status path as the Super Admin suspend (applyOrgStatus).
export async function runGraceSweep(now: Date = new Date()): Promise<{ suspended: number }> {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);
  const lapsed = await prisma.subscription.findMany({
    where: { status: "past_due", pastDueSince: { lt: cutoff } },
    include: { organization: { select: { status: true } } },
  });

  let suspended = 0;
  for (const sub of lapsed) {
    if (sub.organization.status !== "active") continue; // already offline / not active
    await tenantTransaction(async ({ db }) => {
      await applyOrgStatus(db, sub.orgId, "suspended", null, { reason: "subscription_past_due" });
      await db.subscription.update({ where: { id: sub.id }, data: { suspendedForNonpayment: true } });
    });
    suspended += 1;
  }
  return { suspended };
}
