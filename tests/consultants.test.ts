import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  createConsultantCore,
  setOrgStatusCore,
  updateConsultantCore,
} from "../lib/consultants";
import { getActiveOrgBySlug } from "../lib/org";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "cons-test-";

d("Super Admin consultants (SP-1.3)", () => {
  let actorId = "";
  const stamp = Date.now();
  const slug = `${PREFIX}${stamp}`;
  const ownerEmail = `${PREFIX}owner-${stamp}@example.com`;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("provisions org + owner + member + audit entry", async () => {
    const result = await createConsultantCore(
      { orgName: "Test Consultancy", slug, ownerName: "Owner One", ownerEmail },
      actorId,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdOrgIds.push(result.orgId);

    const org = await prisma.organization.findUnique({ where: { id: result.orgId } });
    expect(org?.slug).toBe(slug);
    expect(org?.status).toBe("active");
    expect(org?.ownerUserId).toBeTruthy();

    const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
    expect(owner?.role).toBe("consultant");

    const member = await prisma.orgMember.findFirst({
      where: { organizationId: result.orgId, userId: org!.ownerUserId! },
    });
    expect(member?.role).toBe("consultant");
    expect(member?.isBillableSeat).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "org.create", resourceId: result.orgId },
    });
    expect(audit?.actorUserId).toBe(actorId);
  });

  it("rejects a duplicate slug", async () => {
    const result = await createConsultantCore(
      { orgName: "Dup", slug, ownerName: "X", ownerEmail: `${PREFIX}dup-${stamp}@example.com` },
      actorId,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a reserved slug", async () => {
    const result = await createConsultantCore(
      { orgName: "Reserved", slug: "admin", ownerName: "X", ownerEmail: `${PREFIX}res-${stamp}@example.com` },
      actorId,
    );
    expect(result.ok).toBe(false);
  });

  it("suspend flips status, writes audit, and the public resolver hides it", async () => {
    const orgId = createdOrgIds[0];
    expect(orgId).toBeTruthy();

    await setOrgStatusCore(orgId, "suspended", actorId);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org?.status).toBe("suspended");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "org.suspend", resourceId: orgId },
    });
    expect(audit?.actorUserId).toBe(actorId);

    expect(await getActiveOrgBySlug(slug)).toBeNull();

    // Reactivate brings it back online.
    await setOrgStatusCore(orgId, "active", actorId);
    expect(await getActiveOrgBySlug(slug)).not.toBeNull();
  });

  it("updates the org name (slug stays immutable)", async () => {
    const orgId = createdOrgIds[0];
    const result = await updateConsultantCore(orgId, { orgName: "Renamed Co" }, actorId);
    expect(result.ok).toBe(true);
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    expect(org?.name).toBe("Renamed Co");
    expect(org?.slug).toBe(slug);
  });
});
