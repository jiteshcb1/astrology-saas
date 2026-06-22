import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";

// Integration tests for the SP-1.1 core-tenancy constraints. They run only when a
// DATABASE_URL is configured (a Neon dev branch or local Postgres); otherwise the
// suite skips so `npm test` stays green on an empty .env.local.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const PREFIX = "sp11-test-";

d("SP-1.1 core tenancy constraints", () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    // org_members cascade-delete with their org/user, so removing orgs + users is enough.
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("rejects a duplicate user email (unique)", async () => {
    const email = `${PREFIX}dup-${Date.now()}@example.com`;
    const user = await prisma.user.create({ data: { email, role: "seeker" } });
    createdUserIds.push(user.id);

    await expect(prisma.user.create({ data: { email } })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("rejects a duplicate organization slug (unique)", async () => {
    const slug = `${PREFIX}slug-${Date.now()}`;
    const org = await prisma.organization.create({ data: { name: "Org One", slug } });
    createdOrgIds.push(org.id);

    await expect(
      prisma.organization.create({ data: { name: "Org Two", slug } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects a duplicate (userId, organizationId) membership", async () => {
    const stamp = Date.now();
    const user = await prisma.user.create({
      data: { email: `${PREFIX}member-${stamp}@example.com`, role: "consultant" },
    });
    createdUserIds.push(user.id);
    const org = await prisma.organization.create({
      data: { name: "Membership Org", slug: `${PREFIX}member-${stamp}` },
    });
    createdOrgIds.push(org.id);

    await prisma.orgMember.create({ data: { userId: user.id, organizationId: org.id } });

    await expect(
      prisma.orgMember.create({ data: { userId: user.id, organizationId: org.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("persists a super_admin role and applies tenancy defaults", async () => {
    const stamp = Date.now();
    const admin = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    createdUserIds.push(admin.id);
    expect(admin.role).toBe("super_admin");

    const org = await prisma.organization.create({
      data: { name: "Defaults Org", slug: `${PREFIX}defaults-${stamp}` },
    });
    createdOrgIds.push(org.id);
    expect(org.status).toBe("active");

    const member = await prisma.orgMember.create({
      data: { userId: admin.id, organizationId: org.id },
    });
    expect(member.role).toBe("consultant");
    expect(member.status).toBe("active");
    expect(member.isBillableSeat).toBe(true);
  });
});
