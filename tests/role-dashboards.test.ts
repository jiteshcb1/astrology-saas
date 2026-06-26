import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { canSee, dashboardHomeKind } from "../lib/dashboard-policy";
import { listMemberBookings } from "../lib/member-bookings";
import { getRevenueSummary, getRevenueByPackage, listOrgFinancials } from "../lib/finance";

// ── Pure policy: role isolation matrix (SP-5.3) ───────────────────────────────
describe("dashboard section policy", () => {
  it("consultant (owner) sees owner sections, not member-only ones", () => {
    for (const s of ["home", "packages", "bookings_manage", "availability", "team", "settings", "finance"] as const) {
      expect(canSee("consultant", s)).toBe(true);
    }
    expect(canSee("consultant", "member_bookings")).toBe(false);
    expect(canSee("consultant", "account")).toBe(false);
  });
  it("team_consulting sees only its slice (no finance/packages/team)", () => {
    expect(canSee("team_consulting", "member_bookings")).toBe(true);
    expect(canSee("team_consulting", "availability")).toBe(true);
    expect(canSee("team_consulting", "account")).toBe(true);
    for (const s of ["finance", "packages", "team", "settings", "bookings_manage"] as const) {
      expect(canSee("team_consulting", s)).toBe(false);
    }
  });
  it("team_accounts sees only finance + account (no bookings/availability/packages)", () => {
    expect(canSee("team_accounts", "finance")).toBe(true);
    expect(canSee("team_accounts", "account")).toBe(true);
    for (const s of ["member_bookings", "availability", "packages", "team", "settings", "bookings_manage"] as const) {
      expect(canSee("team_accounts", s)).toBe(false);
    }
  });
  it("dashboardHomeKind routes each role", () => {
    expect(dashboardHomeKind("consultant")).toBe("owner");
    expect(dashboardHomeKind("team_consulting")).toBe("consulting");
    expect(dashboardHomeKind("team_accounts")).toBe("accounts");
  });
});

// ── DB: data-layer isolation ──────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "roledash-";

d("role-scoped data cores", () => {
  const stamp = Date.now();
  let orgId = "";
  let mA = "";
  let mB = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "RD Org", slug: `${PREFIX}org-${stamp}`, status: "active" } });
    orgId = org.id;
    const ua = await prisma.user.create({ data: { email: `${PREFIX}a-${stamp}@example.com`, role: "team_consulting" } });
    const ub = await prisma.user.create({ data: { email: `${PREFIX}b-${stamp}@example.com`, role: "team_consulting" } });
    mA = (await prisma.orgMember.create({ data: { organizationId: orgId, userId: ua.id, role: "team_consulting", status: "active" } })).id;
    mB = (await prisma.orgMember.create({ data: { organizationId: orgId, userId: ub.id, role: "team_consulting", status: "active" } })).id;
    const pkg = await prisma.package.create({ data: { organizationId: orgId, title: "Reading", slug: `r-${stamp}`, allowedDurations: [30], defaultDurationMin: 30, price: 200000 } });

    async function booking(member: string, status: string, seeker: string, payStatus: string, amount: number, withReceipt = false) {
      const b = await prisma.booking.create({ data: { organizationId: orgId, packageId: pkg.id, assignedMemberId: member, durationMin: 30, status, seekerName: seeker, seekerEmail: `${seeker}@x.com` } });
      await prisma.payment.create({ data: { organizationId: orgId, bookingId: b.id, mode: "gateway", amount, currency: "INR", status: payStatus } });
      if (withReceipt) await prisma.receipt.create({ data: { organizationId: orgId, type: "consultation", bookingId: b.id, issuedTo: `CON-${b.id.slice(-6)}`, amount, currency: "INR", pdfUrl: `/r/${b.id}` } });
      return b.id;
    }
    await booking(mA, "confirmed", "Alice", "success", 200000, true);
    await booking(mB, "confirmed", "Bob", "success", 100000);
    await booking(mA, "pending_verification", "Carl", "pending_verification", 50000);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("listMemberBookings returns ONLY the member's own assigned bookings (with seeker)", async () => {
    const a = await listMemberBookings(orgId, mA);
    const b = await listMemberBookings(orgId, mB);
    expect(a.map((x) => x.seekerName).sort()).toEqual(["Alice", "Carl"]);
    expect(b.map((x) => x.seekerName)).toEqual(["Bob"]);
    expect(a.every((x) => "seekerEmail" in x)).toBe(true); // Consulting sees seeker contact
  });

  it("finance revenue counts only success; pending counted separately", async () => {
    const sum = await getRevenueSummary(orgId);
    expect(sum.totalPaise).toBe(300000); // 200000 + 100000 success (50000 pending excluded)
    expect(sum.pendingVerificationCount).toBe(1);
    const byPkg = await getRevenueByPackage(orgId);
    expect(byPkg[0].count).toBe(2);
    expect(byPkg[0].paise).toBe(300000);
  });

  it("listOrgFinancials exposes NO seeker PII (only a booking reference)", async () => {
    const rows = await listOrgFinancials(orgId);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const keys = new Set(rows.flatMap((r) => Object.keys(r)));
    for (const leak of ["seekerName", "seekerEmail", "seekerPhone"]) expect(keys.has(leak)).toBe(false);
    expect(rows.every((r) => r.ref === "—" || r.ref.startsWith("#"))).toBe(true);
    expect(rows.some((r) => r.status === "Paid") && rows.some((r) => r.status === "Pending")).toBe(true);
  });
});
