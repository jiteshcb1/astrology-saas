import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeEffectivePrice } from "@/lib/billing";

// Read-only data for the Super Admin dashboard. Platform tables (organizations/subscriptions) are
// not tenant-scoped, so bare prisma reads are fine (same as existing super-admin reads).

const DAY_MS = 24 * 60 * 60 * 1000;

// DISPLAY-ONLY MRR math — deliberately separate from real billing math (lib/billing.ts).
// Normalizes a subscription's per-interval price to a monthly figure (yearly ÷ 12), in paise.
function monthlyPaise(plan: Pick<SubscriptionPlan, "price" | "includedSeats" | "perSeatPrice" | "billingInterval">, seatCount: number): number {
  const effective = computeEffectivePrice(plan, seatCount);
  return plan.billingInterval === "yearly" ? Math.round(effective / 12) : effective;
}

export async function getDashboardMetrics() {
  const [totalConsultants, activeSubscriptions, suspendedOrgs, activeSubs] = await Promise.all([
    prisma.organization.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.organization.count({ where: { status: "suspended" } }),
    prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
  ]);
  const mrrPaise = activeSubs.reduce((sum, s) => sum + monthlyPaise(s.plan, s.seatCount), 0);
  return { totalConsultants, activeSubscriptions, suspendedOrgs, mrrPaise };
}

export async function getDashboardSignals() {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * DAY_MS);
  const orgRef = { organization: { select: { id: true, name: true } } } as const;

  const [nearingRenewal, pastDue, recentlySuspended, recentSignups] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: "active", currentPeriodEnd: { gte: now, lte: soon } },
      include: orgRef,
      orderBy: { currentPeriodEnd: "asc" },
      take: 5,
    }),
    prisma.subscription.findMany({ where: { status: "past_due" }, include: orgRef, take: 5 }),
    prisma.organization.findMany({
      where: { status: "suspended" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, updatedAt: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
  ]);
  return { nearingRenewal, pastDue, recentlySuspended, recentSignups };
}

export interface TrendBucket {
  label: string;
  count: number;
}

// Consultants created per month over the last `months` (oldest → newest). Computed in JS from
// org createdAt — no chart dependency.
export async function getSignupTrend(months = 6): Promise<TrendBucket[]> {
  const orgs = await prisma.organization.findMany({ select: { createdAt: true } });

  const now = new Date();
  const buckets: { key: string; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-IN", { month: "short" }),
      count: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const org of orgs) {
    const key = `${org.createdAt.getFullYear()}-${org.createdAt.getMonth()}`;
    const i = index.get(key);
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
