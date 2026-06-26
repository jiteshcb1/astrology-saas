import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { CosmicLoader } from "../components/ui/CosmicLoader";
import { Button } from "../components/ui/Button";
import { joinCallState } from "../lib/join-call";
import { formatRelative } from "../lib/relative-time";
import { monthSeries, monthKeyOf, inrShort, chartAriaLabel, type ChartDatum } from "../lib/month-series";
import { getEarningsTrend, getBookingsByPackage } from "../lib/consultant-home";
import { getOrgGrowthTrend } from "../lib/admin-dashboard";

// ── CosmicLoader (pure render) ─────────────────────────────────────────────────
describe("CosmicLoader", () => {
  it("renders all three sizes + variants with role=status", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      for (const variant of ["light", "dark", "auto"] as const) {
        const html = renderToStaticMarkup(createElement(CosmicLoader, { size, variant }));
        expect(html).toContain('role="status"');
        expect(html.length).toBeGreaterThan(0);
      }
    }
  });
  it("renders a visible label when provided", () => {
    expect(renderToStaticMarkup(createElement(CosmicLoader, { label: "Finding available times…" }))).toContain("Finding available times");
  });
});

// ── Button loading state ───────────────────────────────────────────────────────
describe("Button loading", () => {
  it("disables + shows the loader and loadingLabel when loading", () => {
    const html = renderToStaticMarkup(createElement(Button, { loading: true, loadingLabel: "Saving…" }, "Save"));
    expect(html).toContain("disabled");
    expect(html).toContain('role="status"'); // CosmicLoader present
    expect(html).toContain("Saving…");
    expect(html).toContain('aria-busy="true"');
  });
  it("shows children and no loader when idle", () => {
    const html = renderToStaticMarkup(createElement(Button, {}, "Save"));
    expect(html).toContain("Save");
    expect(html).not.toContain('role="status"');
  });
});

// ── Join-call state machine ────────────────────────────────────────────────────
describe("joinCallState", () => {
  const start = 1_000 * 60 * 60 * 24; // arbitrary start
  const end = start + 60 * 60_000;
  it("no link or no start → prepare", () => {
    expect(joinCallState(start, start, end, false).kind).toBe("prepare");
    expect(joinCallState(start, null, end, true).kind).toBe("prepare");
  });
  it("clock unknown → pending", () => {
    expect(joinCallState(null, start, end, true).kind).toBe("pending");
  });
  it("appears exactly within 15 minutes, not before", () => {
    expect(joinCallState(start - 16 * 60_000, start, end, true)).toEqual({ kind: "soon", mins: 1 });
    expect(joinCallState(start - 15 * 60_000, start, end, true).kind).toBe("join");
    expect(joinCallState(start, start, end, true).kind).toBe("join");
    expect(joinCallState(end - 1, start, end, true).kind).toBe("join");
  });
  it("after the session ends → prepare", () => {
    expect(joinCallState(end + 1, start, end, true).kind).toBe("prepare");
  });
});

// ── Relative time ──────────────────────────────────────────────────────────────
describe("formatRelative", () => {
  const now = new Date("2026-06-26T12:00:00Z");
  it("formats each bucket", () => {
    expect(formatRelative(new Date(now.getTime() - 30_000), now)).toBe("just now");
    expect(formatRelative(new Date(now.getTime() - 3 * 60_000), now)).toBe("3 minutes ago");
    expect(formatRelative(new Date(now.getTime() - 60_000), now)).toBe("1 minute ago");
    expect(formatRelative(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3 hours ago");
    expect(formatRelative(new Date(now.getTime() - 5 * 86_400_000), now)).toBe("5 days ago");
    expect(formatRelative(new Date("2026-06-10T12:00:00Z"), now)).toBe("Jun 10, 2026");
  });
});

// ── Chart helpers ──────────────────────────────────────────────────────────────
describe("chart helpers", () => {
  it("monthSeries returns N ordered buckets", () => {
    const s = monthSeries(new Date("2026-06-26T12:00:00Z"), 6);
    expect(s).toHaveLength(6);
    expect(s[5].key).toBe("2026-06");
    expect(s[5].label).toBe("Jun");
    expect(s[5].full).toBe("June 2026");
    expect(s[0].key < s[5].key).toBe(true); // oldest → newest
  });
  it("inrShort abbreviates", () => {
    expect(inrShort(100_000)).toBe("₹1K"); // 1000 rupees
    expect(inrShort(1_000_000)).toBe("₹10K");
    expect(inrShort(50_000)).toBe("₹500");
  });
  it("chartAriaLabel summarizes", () => {
    const data: ChartDatum[] = [
      { key: "2026-05", label: "May", full: "May 2026", value: 800_000, count: 2 },
      { key: "2026-06", label: "Jun", full: "June 2026", value: 1_200_000, count: 3 },
    ];
    expect(chartAriaLabel("Revenue", data, "inr")).toBe("Revenue: ₹8K in May 2026, ₹12K in June 2026.");
    expect(chartAriaLabel("Empty", [], "inr")).toContain("no data yet");
  });
  it("monthKeyOf is stable", () => {
    expect(monthKeyOf(new Date("2026-06-15T20:00:00Z"))).toBe("2026-06");
  });
});

// ── Chart data fns (DB-gated, tenant-isolated) ─────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "sp56-";

d("chart data functions", () => {
  const stamp = Date.now();
  const now = new Date();
  let emptyOrg = "";
  let seededOrg = "";

  beforeAll(async () => {
    const e = await prisma.organization.create({ data: { name: "Empty", slug: `${PREFIX}empty-${stamp}`, status: "active" } });
    emptyOrg = e.id;
    const s = await prisma.organization.create({ data: { name: "Seeded", slug: `${PREFIX}seeded-${stamp}`, status: "active" } });
    seededOrg = s.id;
    const pkg = await prisma.package.create({ data: { organizationId: seededOrg, title: "Reading", slug: `r-${stamp}`, allowedDurations: [30], defaultDurationMin: 30, price: 150000, isActive: true } });
    await prisma.booking.create({ data: { organizationId: seededOrg, packageId: pkg.id, durationMin: 30, status: "confirmed", seekerName: "A" } });
    await prisma.booking.create({ data: { organizationId: seededOrg, packageId: pkg.id, durationMin: 30, status: "confirmed", seekerName: "B" } });
    await prisma.receipt.create({ data: { organizationId: seededOrg, type: "consultation", issuedTo: "X", amount: 150000, currency: "INR" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("earnings trend: empty org → all zero; seeded → this month bucket has the receipt", async () => {
    const empty = await getEarningsTrend(emptyOrg, 6, now);
    expect(empty).toHaveLength(6);
    expect(empty.every((b) => b.value === 0)).toBe(true);

    const seeded = await getEarningsTrend(seededOrg, 6, now);
    const thisMonth = seeded.find((b) => b.key === monthKeyOf(now))!;
    expect(thisMonth.value).toBe(150000);
    expect(thisMonth.count).toBe(1);
  });

  it("bookings by package: empty → []; seeded → one package with 2 bookings at 100%", async () => {
    expect(await getBookingsByPackage(emptyOrg, 90, now)).toEqual([]);
    const seeded = await getBookingsByPackage(seededOrg, 90, now);
    expect(seeded).toHaveLength(1);
    expect(seeded[0].value).toBe(2);
    expect(seeded[0].pct).toBe(100);
  });

  it("org growth trend is cumulative + non-decreasing", async () => {
    const g = await getOrgGrowthTrend(12, now);
    expect(g).toHaveLength(12);
    for (let i = 1; i < g.length; i++) expect(g[i].value).toBeGreaterThanOrEqual(g[i - 1].value);
    expect(g[11].value).toBeGreaterThanOrEqual(2); // at least our two seeded orgs exist this month
  });
});
