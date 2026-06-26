import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";

// SP-5.4: keep Subscription.seatCount in sync with the actual count of ACTIVE BILLABLE members.
// Billable = active member whose role is the owner (consultant) or team_consulting. team_accounts is NEVER
// billable (read-only overhead) — the count is role-based and EXPLICIT (not via the isBillableSeat flag).

export const BILLABLE_ROLES = ["consultant", "team_consulting"] as const;

// The { db, tenant } context handed out by tenantTransaction — reused so a member mutation and its seat
// recount commit in the SAME transaction (no gap between the member change and the seatCount update).
type SyncCtx = Parameters<Parameters<typeof tenantTransaction>[0]>[0];

export type SeatSyncReason = "member_added" | "member_removed" | "role_changed" | "reconciliation";

export function countBillableMembers(orgId: string, tenant: SyncCtx["tenant"]): Promise<number> {
  return tenant(orgId).orgMember.count({ where: { status: "active", role: { in: [...BILLABLE_ROLES] } } });
}

export interface SeatSyncResult {
  changed: boolean;
  seatCount: number;
  overLimit: boolean;
}

// Recount billable members and update Subscription.seatCount if it drifted. Idempotent (no-op when already
// correct). Audits every change. Over-limit (actual > purchasedSeats) is flagged, never auto-charged.
export async function syncSeatCount(ctx: SyncCtx, orgId: string, reason: SeatSyncReason, actorUserId: string | null): Promise<SeatSyncResult> {
  const actual = await countBillableMembers(orgId, ctx.tenant);
  const sub = await ctx.db.subscription.findUnique({ where: { orgId }, select: { id: true, seatCount: true, purchasedSeats: true } });
  if (!sub) return { changed: false, seatCount: actual, overLimit: false }; // no plan assigned → nothing to bill
  const overLimit = actual > sub.purchasedSeats;
  if (sub.seatCount === actual) return { changed: false, seatCount: actual, overLimit };

  await ctx.db.subscription.update({ where: { orgId }, data: { seatCount: actual } });
  await writeAuditLog(
    {
      actorUserId,
      action: "subscription.seat_count_updated",
      resourceType: "subscription",
      resourceId: sub.id,
      orgId,
      metadata: { old: sub.seatCount, new: actual, reason, overLimit, purchasedSeats: sub.purchasedSeats },
    },
    ctx.db,
  );
  return { changed: true, seatCount: actual, overLimit };
}

// Nightly reconciliation: recount billable members for every active org with a subscription and fix any
// drift. Idempotent — running twice produces no duplicate updates. `onlyOrgId` scopes it to one org (tests /
// targeted runs), mirroring expireHoldsCore. Mirrors runGraceSweep (lib/billing-engine) for the global sweep.
export async function reconcileSeatsCore(onlyOrgId?: string): Promise<{ checked: number; updated: number }> {
  const subs = await prisma.subscription.findMany({
    where: onlyOrgId ? { orgId: onlyOrgId } : undefined,
    select: { orgId: true, organization: { select: { status: true } } },
  });
  let checked = 0;
  let updated = 0;
  for (const s of subs) {
    if (s.organization.status !== "active") continue;
    checked += 1;
    const r = await tenantTransaction((ctx) => syncSeatCount(ctx, s.orgId, "reconciliation", null));
    if (r.changed) updated += 1;
  }
  return { checked, updated };
}
