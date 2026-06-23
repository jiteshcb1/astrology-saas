import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { listAllReceipts } from "../lib/oversight";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "ovr-test-";

d("super-admin oversight (SP-1.7)", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgA = "";
  let orgB = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
    const a = await prisma.organization.create({ data: { name: "Ovr A", slug: `${PREFIX}a-${stamp}` } });
    const b = await prisma.organization.create({ data: { name: "Ovr B", slug: `${PREFIX}b-${stamp}` } });
    orgA = a.id;
    orgB = b.id;
    // One receipt in each org (cross-tenant data) + an extra to exercise pagination.
    await prisma.receipt.create({ data: { organizationId: orgA, type: "subscription", issuedTo: "A", amount: 49900, currency: "INR" } });
    await prisma.receipt.create({ data: { organizationId: orgB, type: "subscription", issuedTo: "B", amount: 59900, currency: "INR" } });
    await prisma.receipt.create({ data: { organizationId: orgB, type: "subscription", issuedTo: "B2", amount: 9900, currency: "INR" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades receipts
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("reads receipts across multiple orgs (cross-tenant) and logs access", async () => {
    const before = await prisma.receipt.count();
    const { items, total } = await listAllReceipts(actorId, { page: 1, pageSize: 100 });
    const orgIds = new Set(items.map((r) => r.organizationId));
    expect(orgIds.has(orgA)).toBe(true);
    expect(orgIds.has(orgB)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(3);

    // Access logged.
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "oversight.view" } })).toBeGreaterThan(0);
    // Read-only: nothing was written to receipts.
    expect(await prisma.receipt.count()).toBe(before);
  });

  it("paginates", async () => {
    const p1 = await listAllReceipts(actorId, { page: 1, pageSize: 1 });
    expect(p1.items).toHaveLength(1);
    expect(p1.pageSize).toBe(1);
    expect(Math.ceil(p1.total / p1.pageSize)).toBeGreaterThanOrEqual(3);
  });
});
