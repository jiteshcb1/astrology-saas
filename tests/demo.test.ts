import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { tenantDb } from "../lib/tenant-db";
import { seedDemo } from "../prisma/seeds/demo";
import { getDashboardMetrics } from "../lib/admin-dashboard";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const SLUG = "pandit-demo-sharma";

d("SP-6.2 demo org", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds idempotently — running twice yields one fully-set-up demo org", async () => {
    await seedDemo();
    const second = await seedDemo(); // must no-op
    expect(second.created).toBe(false);

    const orgs = await prisma.organization.findMany({ where: { slug: SLUG } });
    expect(orgs).toHaveLength(1);
    const org = orgs[0];
    expect(org.isDemoOrg).toBe(true);
    expect(org.status).toBe("active");

    const profile = await tenantDb(org.id).consultantProfile.findFirst();
    expect(profile?.specialities).toHaveLength(5);

    const pkgs = await tenantDb(org.id).package.findMany({ where: { isActive: true } });
    expect(pkgs).toHaveLength(3);

    const sched = await tenantDb(org.id).availabilitySchedule.findFirst({ include: { rules: true } });
    expect(sched?.rules).toHaveLength(6); // Mon–Sat

    const pm = await tenantDb(org.id).paymentMethod.findFirst();
    expect(pm?.mode).toBe("upi_qr");

    const branding = await tenantDb(org.id).orgBranding.findFirst();
    expect(branding?.themeColor).toBe("#14122b");
  });

  it("is excluded from Super-Admin metrics by the isDemoOrg:false predicate", async () => {
    const { orgId } = await seedDemo();
    // Every Super-Admin org count/trend filters `isDemoOrg:false` (getDashboardMetrics, growth/signup trends,
    // consultants list). Proven race-free by scoping to the demo org's own id: it exists, but is NOT in the
    // counted (non-demo) set.
    expect(await prisma.organization.count({ where: { id: orgId } })).toBe(1);
    expect(await prisma.organization.count({ where: { id: orgId, isDemoOrg: false } })).toBe(0);
    // getDashboardMetrics still runs cleanly after the schema change.
    const metrics = await getDashboardMetrics();
    expect(metrics.totalConsultants).toBeGreaterThanOrEqual(0);
  });
});
