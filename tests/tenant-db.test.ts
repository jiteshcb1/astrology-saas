import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { tenantDb, tenantTransaction } from "../lib/tenant-db";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "tdb-test-";

d("tenant-db structural isolation", () => {
  let orgA = "";
  let orgB = "";
  const stamp = Date.now();

  beforeAll(async () => {
    const a = await prisma.organization.create({ data: { name: "A", slug: `${PREFIX}a-${stamp}` } });
    const b = await prisma.organization.create({ data: { name: "B", slug: `${PREFIX}b-${stamp}` } });
    orgA = a.id;
    orgB = b.id;
    const uA = await prisma.user.create({ data: { email: `${PREFIX}a-${stamp}@example.com`, role: "consultant" } });
    const uB = await prisma.user.create({ data: { email: `${PREFIX}b-${stamp}@example.com`, role: "consultant" } });
    await tenantDb(orgA).orgMember.create({ data: { userId: uA.id, role: "consultant", status: "active", isBillableSeat: true } });
    await tenantDb(orgB).orgMember.create({ data: { userId: uB.id, role: "consultant", status: "active", isBillableSeat: true } });
  });

  afterAll(async () => {
    // Members cascade-delete with their org/user.
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns only the scoped org's rows", async () => {
    const rows = await tenantDb(orgA).orgMember.findMany();
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.organizationId === orgA)).toBe(true);
    expect(await tenantDb(orgA).orgMember.count()).toBe(1);
  });

  it("overrides a foreign organizationId passed in where (can't read another tenant)", async () => {
    const rows = await tenantDb(orgA).orgMember.findMany({ where: { organizationId: orgB } });
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.organizationId === orgA)).toBe(true);
  });

  it("forces organizationId on create, ignoring a smuggled value", async () => {
    const uC = await prisma.user.create({ data: { email: `${PREFIX}c-${stamp}@example.com`, role: "consultant" } });
    // Smuggle a foreign organizationId past the type via a cast — the facade must override it.
    const created = await tenantDb(orgB).orgMember.create({
      data: { userId: uC.id, organizationId: orgA } as unknown as { userId: string },
    });
    expect(created.organizationId).toBe(orgB);
  });

  it("blocks raw tenant-model access inside tenantTransaction, but tenant() works", async () => {
    await expect(
      tenantTransaction(async ({ db }) => {
        // @ts-expect-error orgMember is removed from the non-tenant client's type
        return db.orgMember.findMany();
      }),
    ).rejects.toThrow(/not accessible/);

    const uD = await prisma.user.create({ data: { email: `${PREFIX}d-${stamp}@example.com`, role: "consultant" } });
    const member = await tenantTransaction(async ({ tenant }) =>
      tenant(orgA).orgMember.create({
        data: { userId: uD.id, role: "consultant", status: "active", isBillableSeat: true },
      }),
    );
    expect(member.organizationId).toBe(orgA);
  });
});
