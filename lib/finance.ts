import type { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/tenant-db";
import { utcToZonedParts } from "@/lib/timezone";

// SP-5.3: org financials for the Accounts role. Revenue = Payment.status "success". NEVER exposes seeker
// name/PII — booking rows carry only a booking reference id. All reads are tenant-scoped.

const TZ = "Asia/Kolkata";
const SUCCESS = "success";

function monthKey(d: Date): string {
  const p = utcToZonedParts(d, TZ);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}
function shiftMonthKey(now: Date, back: number): string {
  const p = utcToZonedParts(now, TZ);
  let y = p.year;
  let m = p.month - back;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export interface RevenueSummary {
  totalPaise: number;
  thisMonthPaise: number;
  lastMonthPaise: number;
  pendingVerificationCount: number;
}

export async function getRevenueSummary(orgId: string, now: Date = new Date()): Promise<RevenueSummary> {
  const [success, pending] = await Promise.all([
    tenantDb(orgId).payment.findMany({ where: { status: SUCCESS }, select: { amount: true, createdAt: true } }),
    tenantDb(orgId).payment.count({ where: { status: "pending_verification" } }),
  ]);
  const thisKey = monthKey(now);
  const lastKey = shiftMonthKey(now, 1);
  let total = 0;
  let thisMonth = 0;
  let lastMonth = 0;
  for (const p of success) {
    total += p.amount;
    const k = monthKey(p.createdAt);
    if (k === thisKey) thisMonth += p.amount;
    else if (k === lastKey) lastMonth += p.amount;
  }
  return { totalPaise: total, thisMonthPaise: thisMonth, lastMonthPaise: lastMonth, pendingVerificationCount: pending };
}

export interface MonthlyRevenue {
  label: string;
  paise: number;
}
export async function getMonthlyRevenue(orgId: string, now: Date = new Date(), months = 6): Promise<MonthlyRevenue[]> {
  const success = await tenantDb(orgId).payment.findMany({ where: { status: SUCCESS }, select: { amount: true, createdAt: true } });
  const sums = new Map<string, number>();
  for (const p of success) sums.set(monthKey(p.createdAt), (sums.get(monthKey(p.createdAt)) ?? 0) + p.amount);
  const nowP = utcToZonedParts(now, TZ);
  const out: MonthlyRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(now, i);
    const [, mm] = key.split("-").map(Number);
    const label = new Date(Date.UTC(nowP.year, mm - 1, 1)).toLocaleDateString("en-IN", { month: "short" });
    out.push({ label, paise: sums.get(key) ?? 0 });
  }
  return out;
}

export interface PackageRevenue {
  title: string;
  count: number;
  paise: number;
}
type PayWithPkg = Prisma.PaymentGetPayload<{ include: { booking: { include: { package: { select: { title: true } } } } } }>;
export async function getRevenueByPackage(orgId: string): Promise<PackageRevenue[]> {
  const rows = (await tenantDb(orgId).payment.findMany({
    where: { status: SUCCESS },
    include: { booking: { include: { package: { select: { title: true } } } } },
  })) as PayWithPkg[];
  const map = new Map<string, { count: number; paise: number }>();
  for (const r of rows) {
    const title = r.booking?.package?.title ?? "—";
    const e = map.get(title) ?? { count: 0, paise: 0 };
    e.count += 1;
    e.paise += r.amount;
    map.set(title, e);
  }
  return Array.from(map.entries())
    .map(([title, v]) => ({ title, count: v.count, paise: v.paise }))
    .sort((a, b) => b.paise - a.paise);
}

// Unified financial list (no seeker PII — booking rows carry only a reference id).
export interface FinancialRow {
  dateISO: string;
  type: "booking" | "subscription";
  ref: string;
  amountPaise: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
}
const STATUS_LABEL: Record<string, string> = { success: "Paid", pending_verification: "Pending", failed: "Failed", refunded: "Refunded", initiated: "Initiated" };

export async function listOrgFinancials(orgId: string, filters: { from?: string; to?: string; status?: string } = {}): Promise<FinancialRow[]> {
  const [payments, receipts] = await Promise.all([
    tenantDb(orgId).payment.findMany({ select: { bookingId: true, amount: true, currency: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    tenantDb(orgId).receipt.findMany({ select: { type: true, bookingId: true, amount: true, currency: true, issuedAt: true, pdfUrl: true } }),
  ]);
  const pdfByBooking = new Map<string, string>();
  for (const r of receipts) if (r.type === "consultation" && r.bookingId && r.pdfUrl) pdfByBooking.set(r.bookingId, r.pdfUrl);

  const rows: FinancialRow[] = [];
  for (const p of payments) {
    rows.push({
      dateISO: p.createdAt.toISOString(),
      type: "booking",
      ref: `#${p.bookingId.slice(0, 8)}`,
      amountPaise: p.amount,
      currency: p.currency,
      status: STATUS_LABEL[p.status] ?? p.status,
      pdfUrl: pdfByBooking.get(p.bookingId) ?? null,
    });
  }
  for (const r of receipts) {
    if (r.type !== "subscription") continue;
    rows.push({ dateISO: r.issuedAt.toISOString(), type: "subscription", ref: "—", amountPaise: r.amount, currency: r.currency, status: "Paid", pdfUrl: r.pdfUrl ?? null });
  }

  const fromMs = filters.from ? Date.parse(`${filters.from}T00:00:00.000Z`) : null;
  const toMs = filters.to ? Date.parse(`${filters.to}T23:59:59.999Z`) : null;
  const status = filters.status?.toLowerCase();
  return rows
    .filter((r) => {
      const t = Date.parse(r.dateISO);
      if (fromMs != null && t < fromMs) return false;
      if (toMs != null && t > toMs) return false;
      if (status && status !== "all" && r.status.toLowerCase() !== status) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO));
}
