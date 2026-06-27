import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeEffectivePrice } from "@/lib/billing";
import { monthKeyOf, monthSeries, type ChartDatum } from "@/lib/month-series";

// Read-only data for the Super Admin dashboard. Platform tables (organizations/subscriptions) are
// not tenant-scoped, so bare prisma reads are fine (same as existing super-admin reads).

const DAY_MS = 24 * 60 * 60 * 1000;

// DISPLAY-ONLY MRR math — deliberately separate from real billing math (lib/billing.ts).
// Normalizes a subscription's per-interval price to a monthly figure (yearly ÷ 12), in paise.
function monthlyPaise(plan: Pick<SubscriptionPlan, "price" | "includedSeats" | "perSeatPrice" | "billingInterval">, seatCount: number): number {
  const effective = computeEffectivePrice(plan, seatCount);
  return plan.billingInterval === "yearly" ? Math.round(effective / 12) : effective;
}

// Delta = new-this-month (createdAt within 30d). null when the platform is younger than 30 days
// (insufficient history) — per the "never show a misleading comparison" rule.
export interface Delta {
  value: number;
}
export interface DashboardMetrics {
  totalConsultants: number;
  activeSubscriptions: number;
  suspendedOrgs: number;
  mrrPaise: number;
  consultantsDelta: Delta | null;
  activeSubsDelta: Delta | null; // MRR intentionally has NO delta (no historical snapshot)
  newLeadsThisWeek: number; // SP-6.3 dashboard signal
}

export async function getDashboardMetrics(now: Date = new Date()): Promise<DashboardMetrics> {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  // SP-6.2 — the platform-owned demo org is excluded from all org counts/trends.
  const [totalConsultants, activeSubscriptions, suspendedOrgs, activeSubs, newConsultants, newActiveSubs, oldest, newLeadsThisWeek] = await Promise.all([
    prisma.organization.count({ where: { isDemoOrg: false } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.organization.count({ where: { status: "suspended", isDemoOrg: false } }),
    prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
    prisma.organization.count({ where: { createdAt: { gte: since }, isDemoOrg: false } }),
    prisma.subscription.count({ where: { status: "active", createdAt: { gte: since } } }),
    prisma.organization.findFirst({ where: { isDemoOrg: false }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.lead.count({ where: { status: "new", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
  ]);
  const mrrPaise = activeSubs.reduce((sum, s) => sum + monthlyPaise(s.plan, s.seatCount), 0);
  const platformYoung = !oldest || now.getTime() - oldest.createdAt.getTime() < 30 * DAY_MS;
  return {
    totalConsultants,
    activeSubscriptions,
    suspendedOrgs,
    mrrPaise,
    consultantsDelta: platformYoung ? null : { value: newConsultants },
    activeSubsDelta: platformYoung ? null : { value: newActiveSubs },
    newLeadsThisWeek,
  };
}

export interface NearingRenewalItem { orgId: string; orgName: string; planName: string; currentPeriodEnd: Date | null; amountPaise: number }
export interface PastDueItem { orgId: string; orgName: string; pastDueSince: Date | null; amountPaise: number }
export interface SuspendedItem { orgId: string; orgName: string; suspendedAt: Date; reason: string | null }
export interface SignupItem { orgId: string; orgName: string; ownerEmail: string | null; planName: string | null; createdAt: Date }
export interface OverSeatItem { orgId: string; orgName: string; seatCount: number; purchasedSeats: number }
export interface SignalList<T> { items: T[]; hasMore: boolean }

function list<T>(rows: T[]): SignalList<T> {
  return { items: rows.slice(0, 5), hasMore: rows.length > 5 };
}

export async function getDashboardSignals(now: Date = new Date()) {
  const soon = new Date(now.getTime() + 7 * DAY_MS);
  const subInclude = { organization: { select: { id: true, name: true } }, plan: true } as const;

  const [renewRows, pastDueRows, suspendedRows, signupRows, allActiveSubs] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "active", currentPeriodEnd: { gte: now, lte: soon } }, include: subInclude, orderBy: { currentPeriodEnd: "asc" }, take: 6 }),
    prisma.subscription.findMany({ where: { status: "past_due" }, include: subInclude, orderBy: { pastDueSince: "asc" }, take: 6 }),
    prisma.organization.findMany({ where: { status: "suspended" }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, updatedAt: true } }),
    prisma.organization.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, createdAt: true, owner: { select: { email: true } }, subscription: { select: { plan: { select: { name: true } } } } } }),
    prisma.subscription.findMany({ where: { status: "active" }, select: { seatCount: true, purchasedSeats: true, organization: { select: { id: true, name: true } } } }),
  ]);

  // Latest suspend reason per suspended org — ONE audit query (no N+1).
  const suspendedIds = suspendedRows.map((o) => o.id);
  const reasonByOrg = new Map<string, string | null>();
  if (suspendedIds.length) {
    const audits = await prisma.auditLog.findMany({ where: { action: "org.suspend", orgId: { in: suspendedIds } }, orderBy: { createdAt: "desc" }, select: { orgId: true, metadata: true } });
    for (const a of audits) {
      if (a.orgId && !reasonByOrg.has(a.orgId)) {
        const reason = a.metadata && typeof a.metadata === "object" && "reason" in a.metadata ? String((a.metadata as { reason?: unknown }).reason ?? "") : null;
        reasonByOrg.set(a.orgId, reason || null);
      }
    }
  }

  const nearingRenewal = list<NearingRenewalItem>(renewRows.map((s) => ({ orgId: s.organization.id, orgName: s.organization.name, planName: s.plan.name, currentPeriodEnd: s.currentPeriodEnd, amountPaise: computeEffectivePrice(s.plan, s.seatCount) })));
  const pastDue = list<PastDueItem>(pastDueRows.map((s) => ({ orgId: s.organization.id, orgName: s.organization.name, pastDueSince: s.pastDueSince, amountPaise: computeEffectivePrice(s.plan, s.seatCount) })));
  const recentlySuspended = list<SuspendedItem>(suspendedRows.map((o) => ({ orgId: o.id, orgName: o.name, suspendedAt: o.updatedAt, reason: reasonByOrg.get(o.id) ?? null })));
  const recentSignups = list<SignupItem>(signupRows.map((o) => ({ orgId: o.id, orgName: o.name, ownerEmail: o.owner?.email ?? null, planName: o.subscription?.plan.name ?? null, createdAt: o.createdAt })));
  const overSeatLimit = list<OverSeatItem>(allActiveSubs.filter((s) => s.seatCount > s.purchasedSeats).map((s) => ({ orgId: s.organization.id, orgName: s.organization.name, seatCount: s.seatCount, purchasedSeats: s.purchasedSeats })));

  // "All clear" = no ACTIONABLE problems (recent signups is informational, not a problem to act on).
  const allClear = nearingRenewal.items.length === 0 && pastDue.items.length === 0 && recentlySuspended.items.length === 0 && overSeatLimit.items.length === 0;

  return { nearingRenewal, pastDue, recentlySuspended, recentSignups, overSeatLimit, allClear };
}

export interface TrendBucket {
  label: string;
  count: number;
}

// Consultants created per month over the last `months` (oldest → newest). Computed in JS from
// org createdAt — no chart dependency.
// SP-5.6 — cumulative consultant (org) count by IST month over the last `months` (for the growth area chart).
export async function getOrgGrowthTrend(months = 12, now: Date = new Date()): Promise<ChartDatum[]> {
  const orgs = await prisma.organization.findMany({ where: { isDemoOrg: false }, select: { createdAt: true } });
  const keys = orgs.map((o) => monthKeyOf(o.createdAt));
  return monthSeries(now, months).map((b) => {
    const value = keys.filter((k) => k <= b.key).length; // "YYYY-MM" compares lexically
    return { ...b, value, count: value };
  });
}

export async function getSignupTrend(months = 6): Promise<TrendBucket[]> {
  const orgs = await prisma.organization.findMany({ where: { isDemoOrg: false }, select: { createdAt: true } });

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
