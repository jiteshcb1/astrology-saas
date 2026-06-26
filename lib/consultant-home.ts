import type { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/tenant-db";
import { getProfile } from "@/lib/consultant-profile";
import { getPaymentMethod } from "@/lib/payments";
import { utcToZonedParts, zonedClockToUtc } from "@/lib/timezone";
import { monthKeyOf, monthSeries, monthStartUtcOf, type ChartDatum } from "@/lib/month-series";

// SP-5.5: the consultant OWNER home, all real data (tenantDb-scoped, aggregated in-DB). No fabricated numbers —
// "completed" isn't a status, so confirmed bookings are the source of truth; earnings come from consultation
// receipts (booking income), never subscription receipts (what the consultant pays us).

const TZ = "Asia/Kolkata";

// UTC instant for 00:00 on the 1st of the month `monthsBack` months before `now`, in the given tz.
function monthStartUtc(now: Date, tz: string, monthsBack: number): Date {
  const p = utcToZonedParts(now, tz);
  let y = p.year;
  let m = p.month - monthsBack;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return zonedClockToUtc(`${y}-${String(m).padStart(2, "0")}-01`, "00:00", tz);
}

export interface OwnerStatCards {
  totalBookings: number;
  earningsThisMonthPaise: number;
  earningsLastMonthPaise: number;
  upcomingCount: number;
  nextStartsAt: Date | null;
}

export async function getOwnerStatCards(orgId: string, now: Date = new Date()): Promise<OwnerStatCards> {
  const thisStart = monthStartUtc(now, TZ, 0);
  const lastStart = monthStartUtc(now, TZ, 1);
  const [totalBookings, earnThis, earnLast, upcomingCount, nextBooking] = await Promise.all([
    tenantDb(orgId).booking.count({ where: { status: "confirmed" } }),
    tenantDb(orgId).receipt.aggregate({ _sum: { amount: true }, where: { type: "consultation", issuedAt: { gte: thisStart } } }),
    tenantDb(orgId).receipt.aggregate({ _sum: { amount: true }, where: { type: "consultation", issuedAt: { gte: lastStart, lt: thisStart } } }),
    tenantDb(orgId).booking.count({ where: { status: "confirmed", slot: { startsAt: { gt: now }, active: true } } }),
    tenantDb(orgId).booking.findFirst({
      where: { status: "confirmed", slot: { startsAt: { gt: now }, active: true } },
      orderBy: { slot: { startsAt: "asc" } },
      select: { slot: { select: { startsAt: true } } },
    }),
  ]);
  return {
    totalBookings,
    earningsThisMonthPaise: earnThis._sum?.amount ?? 0,
    earningsLastMonthPaise: earnLast._sum?.amount ?? 0,
    upcomingCount,
    nextStartsAt: (nextBooking as { slot: { startsAt: Date } | null } | null)?.slot?.startsAt ?? null,
  };
}

export interface OwnerUpcomingRow {
  id: string;
  seekerName: string | null;
  packageTitle: string;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMin: number;
  status: string;
  hostName: string | null;
}
type UpRow = Prisma.BookingGetPayload<{ include: { package: { select: { title: true } }; slot: { select: { startsAt: true; endsAt: true; hostMemberId: true } } } }>;

export async function getOwnerUpcoming(orgId: string, now: Date = new Date()): Promise<{ hasTeam: boolean; rows: OwnerUpcomingRow[] }> {
  const rows = (await tenantDb(orgId).booking.findMany({
    where: { status: "confirmed", slot: { startsAt: { gt: now }, active: true } },
    orderBy: { slot: { startsAt: "asc" } },
    take: 10,
    include: { package: { select: { title: true } }, slot: { select: { startsAt: true, endsAt: true, hostMemberId: true } } },
  })) as UpRow[];

  const hostIds = [...new Set(rows.map((r) => r.slot?.hostMemberId).filter((x): x is string => Boolean(x)))];
  const [members, teamCount] = await Promise.all([
    hostIds.length
      ? tenantDb(orgId).orgMember.findMany({ where: { id: { in: hostIds } }, include: { user: { select: { name: true } } } })
      : Promise.resolve([] as { id: string; user: { name: string | null } | null }[]),
    tenantDb(orgId).orgMember.count({ where: { role: "team_consulting", status: "active" } }),
  ]);
  const nameById = new Map((members as { id: string; user: { name: string | null } | null }[]).map((m) => [m.id, m.user?.name ?? null]));

  return {
    hasTeam: teamCount > 0,
    rows: rows.map((r) => ({
      id: r.id,
      seekerName: r.seekerName,
      packageTitle: r.package.title,
      startsAt: r.slot?.startsAt ?? null,
      endsAt: r.slot?.endsAt ?? null,
      durationMin: r.durationMin,
      status: r.status,
      hostName: r.slot ? nameById.get(r.slot.hostMemberId) ?? null : null,
    })),
  };
}

export interface ChecklistItemState {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta: string;
}
export async function getOwnerChecklist(orgId: string): Promise<{ items: ChecklistItemState[]; doneCount: number; total: number; allDone: boolean }> {
  const [profile, scheduleCount, packageCount, payment, bookingCount] = await Promise.all([
    getProfile(orgId),
    tenantDb(orgId).availabilitySchedule.count(),
    tenantDb(orgId).package.count({ where: { isActive: true } }),
    getPaymentMethod(orgId),
    tenantDb(orgId).booking.count(),
  ]);
  const items: ChecklistItemState[] = [
    { key: "profile", label: "Complete your profile", done: Boolean(profile?.displayName && profile?.bio), href: "/dashboard/settings/profile", cta: "Complete profile" },
    { key: "availability", label: "Set your availability", done: scheduleCount > 0, href: "/dashboard/availability", cta: "Set availability" },
    { key: "package", label: "Create your first package", done: packageCount > 0, href: "/dashboard/packages/new", cta: "Create a package" },
    { key: "payment", label: "Configure a payment method", done: Boolean(payment), href: "/dashboard/settings/payments", cta: "Add payment method" },
    { key: "booking", label: "Receive your first booking", done: bookingCount > 0, cta: "Share your page" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return { items, doneCount, total: items.length, allDone: doneCount === items.length };
}

// SP-5.6 charts. Earnings = consultation receipts (the SP-5.5 earnings-card source) bucketed by IST month.
export async function getEarningsTrend(orgId: string, months = 6, now: Date = new Date()): Promise<ChartDatum[]> {
  const buckets = monthSeries(now, months);
  const rows = await tenantDb(orgId).receipt.findMany({
    where: { type: "consultation", issuedAt: { gte: monthStartUtcOf(buckets[0].key) } },
    select: { amount: true, issuedAt: true },
  });
  const agg = new Map(buckets.map((b) => [b.key, { value: 0, count: 0 }]));
  for (const r of rows) {
    const e = agg.get(monthKeyOf(r.issuedAt));
    if (e) {
      e.value += r.amount;
      e.count += 1;
    }
  }
  return buckets.map((b) => ({ ...b, value: agg.get(b.key)!.value, count: agg.get(b.key)!.count }));
}

// Confirmed bookings grouped by package over the last `days`, with each package's share of the total.
export async function getBookingsByPackage(orgId: string, days = 90, now: Date = new Date()): Promise<ChartDatum[]> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = (await tenantDb(orgId).booking.findMany({
    where: { status: "confirmed", createdAt: { gte: since } },
    select: { packageId: true, package: { select: { title: true } } },
  })) as unknown as { packageId: string; package: { title: string } }[];
  const agg = new Map<string, { title: string; count: number }>();
  for (const r of rows) {
    const e = agg.get(r.packageId) ?? { title: r.package.title, count: 0 };
    e.count += 1;
    agg.set(r.packageId, e);
  }
  const total = rows.length;
  return [...agg.entries()]
    .map(([key, v]) => ({ key, label: v.title, full: v.title, value: v.count, count: v.count, pct: total ? Math.round((v.count / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}
