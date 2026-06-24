import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getActiveOrgBySlug } from "../lib/public-page";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "pub-";

d("getActiveOrgBySlug (SP-4.1 public read path)", () => {
  const stamp = Date.now();
  const slug = `${PREFIX}org-${stamp}`;
  let orgId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${PREFIX}owner-${stamp}@example.com`, role: "consultant" } });
    const org = await prisma.organization.create({ data: { name: "Public Org", slug, status: "active", ownerUserId: user.id } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { organizationId: orgId, userId: user.id, role: "consultant", status: "active" } });
    await prisma.consultantProfile.create({
      data: { organizationId: orgId, displayName: "Pandit Ravi", bio: "Vedic astrologer", specialities: ["Kundali Reading"], complaintsContactNumber: "+91 9876543210", onboardedAt: new Date() },
    });
    await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", isDefault: true } });
    await prisma.package.create({
      data: { organizationId: orgId, title: "Kundali Reading", slug: "kundali-reading", allowedDurations: [30], defaultDurationMin: 30, price: 110000, isActive: true },
    });
    await prisma.package.create({
      data: { organizationId: orgId, title: "Hidden", slug: "hidden", allowedDurations: [30], defaultDurationMin: 30, price: 50000, isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades members/profile/packages/schedule
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns a public bundle for an ACTIVE org (active packages only, with host + tz)", async () => {
    const data = await getActiveOrgBySlug(slug);
    expect(data).not.toBeNull();
    expect(data!.profile.displayName).toBe("Pandit Ravi");
    expect(data!.profile.specialities).toEqual(["Kundali Reading"]);
    expect(data!.timezone).toBe("Asia/Kolkata");
    expect(data!.hostMemberId).toBeTruthy();
    expect(data!.packages.map((p) => p.title)).toEqual(["Kundali Reading"]); // inactive excluded
    expect(data!.packages[0].priceLabel).toContain("1,100");
  });

  it("exposes no secret fields", async () => {
    const dump = JSON.stringify(await getActiveOrgBySlug(slug));
    expect(dump).not.toMatch(/Enc"|gstNumber|gatewayKey|keySecret/i);
  });

  it("returns null for a suspended org", async () => {
    await prisma.organization.update({ where: { id: orgId }, data: { status: "suspended" } });
    expect(await getActiveOrgBySlug(slug)).toBeNull();
    await prisma.organization.update({ where: { id: orgId }, data: { status: "active" } });
  });

  it("returns null for an unknown slug", async () => {
    expect(await getActiveOrgBySlug(`${PREFIX}nope-${stamp}`)).toBeNull();
  });
});
