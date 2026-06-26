import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { EmptyState, type EmptyVariant } from "../components/ui/EmptyState";
import { StatCardSkeleton, StatCardSkeletonRow, TableSkeleton, ChartSkeleton, SectionSkeleton, ChecklistSkeleton } from "../components/ui/skeletons";
import { getOwnerStatCards, getOwnerChecklist } from "../lib/consultant-home";
import { getDashboardMetrics, getDashboardSignals } from "../lib/admin-dashboard";

// ── Pure render: empty states + skeletons never crash (no DB) ──────────────────
describe("EmptyState + skeletons render", () => {
  const VARIANTS: EmptyVariant[] = [
    "no_bookings_yet", "no_earnings_yet", "no_team_yet", "no_packages_consultant", "no_packages_public",
    "no_upcoming_sessions", "no_ratings_yet", "no_receipts_yet", "chart_insufficient_data", "consultant_all_done",
  ];
  it("renders every EmptyState variant", () => {
    for (const variant of VARIANTS) {
      const html = renderToStaticMarkup(createElement(EmptyState, { variant }));
      expect(html.length).toBeGreaterThan(0);
    }
  });
  it("renders legacy EmptyState + every skeleton", () => {
    expect(renderToStaticMarkup(createElement(EmptyState, { title: "x", message: "y" })).length).toBeGreaterThan(0);
    for (const el of [
      createElement(StatCardSkeleton),
      createElement(StatCardSkeletonRow),
      createElement(TableSkeleton, { rowCount: 3 }),
      createElement(ChartSkeleton, { height: 120, label: "x" }),
      createElement(SectionSkeleton),
      createElement(ChecklistSkeleton),
    ]) {
      expect(renderToStaticMarkup(el).length).toBeGreaterThan(0);
    }
  });
});

// ── DB-backed (tenant-scoped consultant home is deterministic) ─────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "dashmetrics-";

d("consultant owner home metrics", () => {
  const stamp = Date.now();
  let emptyOrg = "";
  let seededOrg = "";

  beforeAll(async () => {
    const e = await prisma.organization.create({ data: { name: "Empty", slug: `${PREFIX}empty-${stamp}`, status: "active" } });
    emptyOrg = e.id;
    const s = await prisma.organization.create({ data: { name: "Seeded", slug: `${PREFIX}seeded-${stamp}`, status: "active" } });
    seededOrg = s.id;
    const pkg = await prisma.package.create({ data: { organizationId: seededOrg, title: "Reading", slug: `r-${stamp}`, allowedDurations: [30], defaultDurationMin: 30, price: 200000, isActive: true } });
    const booking = await prisma.booking.create({ data: { organizationId: seededOrg, packageId: pkg.id, durationMin: 30, status: "confirmed", seekerName: "Seek" } });
    const future = new Date(Date.now() + 7 * 86_400_000);
    await prisma.bookingSlot.create({ data: { organizationId: seededOrg, bookingId: booking.id, hostMemberId: "h1", startsAt: future, endsAt: new Date(future.getTime() + 30 * 60_000), active: true } });
    await prisma.receipt.create({ data: { organizationId: seededOrg, type: "consultation", bookingId: booking.id, issuedTo: "CON-1", amount: 200000, currency: "INR" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("empty org → zeros + no next session; checklist all incomplete", async () => {
    const s = await getOwnerStatCards(emptyOrg);
    expect(s.totalBookings).toBe(0);
    expect(s.earningsThisMonthPaise).toBe(0);
    expect(s.upcomingCount).toBe(0);
    expect(s.nextStartsAt).toBeNull();
    const c = await getOwnerChecklist(emptyOrg);
    expect(c.doneCount).toBe(0);
    expect(c.allDone).toBe(false);
  });

  it("seeded org → real counts/sums from the DB", async () => {
    const s = await getOwnerStatCards(seededOrg);
    expect(s.totalBookings).toBe(1);
    expect(s.earningsThisMonthPaise).toBe(200000); // this-month consultation receipt
    expect(s.upcomingCount).toBe(1);
    expect(s.nextStartsAt).toBeTruthy();
    const c = await getOwnerChecklist(seededOrg);
    const done = new Map(c.items.map((i) => [i.key, i.done]));
    expect(done.get("package")).toBe(true); // active package exists
    expect(done.get("booking")).toBe(true); // a booking exists
    expect(done.get("availability")).toBe(false); // none set
  });

  it("super-admin metrics + signals return the expected shape", async () => {
    const m = await getDashboardMetrics();
    expect(typeof m.totalConsultants).toBe("number");
    expect(typeof m.mrrPaise).toBe("number");
    expect("consultantsDelta" in m).toBe(true); // null or { value }
    const sig = await getDashboardSignals();
    expect(typeof sig.allClear).toBe("boolean");
    for (const key of ["nearingRenewal", "pastDue", "recentlySuspended", "recentSignups", "overSeatLimit"] as const) {
      expect(Array.isArray(sig[key].items)).toBe(true);
      expect(typeof sig[key].hasMore).toBe("boolean");
    }
  });
});
