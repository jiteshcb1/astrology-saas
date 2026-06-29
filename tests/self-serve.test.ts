import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { provisionSelfServeOrgCore } from "../lib/self-serve";

// SP-7.1 — self-serve consultant provisioning. DB-gated (skips without DATABASE_URL), like the other
// integration tests. The dashboard guards resolve role/org live, so we assert the DB state directly.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "selfserve-test-";

d("Self-serve signup (SP-7.1)", () => {
  const stamp = Date.now();
  const userIds: string[] = [];
  const orgIds: string[] = [];
  let ensuredPlanId: string | null = null;

  const mkUser = async (label: string, name?: string) => {
    const u = await prisma.user.create({
      data: { email: `${PREFIX}${label}-${stamp}@example.com`, name: name ?? null, role: "seeker" },
    });
    userIds.push(u.id);
    return u;
  };

  beforeAll(async () => {
    // Guarantee a free Starter-style plan exists (the seed creates one; create a fallback if absent).
    const free = await prisma.subscriptionPlan.findFirst({ where: { isActive: true, price: 0 } });
    if (!free) {
      const p = await prisma.subscriptionPlan.create({
        data: { name: `${PREFIX}starter`, price: 0, includedSeats: 1, perSeatPrice: 0, currency: "INR", billingInterval: "monthly", isActive: true, features: {} },
      });
      ensuredPlanId = p.id;
    }
  });

  afterAll(async () => {
    for (const id of orgIds) await prisma.organization.delete({ where: { id } }).catch(() => {});
    if (ensuredPlanId) await prisma.subscriptionPlan.delete({ where: { id: ensuredPlanId } }).catch(() => {});
    for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {});
    await prisma.signupAttempt.deleteMany({ where: { email: { startsWith: PREFIX } } }).catch(() => {});
    await prisma.signupAttempt.deleteMany({ where: { requestIp: `ip-${stamp}` } }).catch(() => {});
  });

  it("creates a solo consultant org on the free plan, with the user as owner", async () => {
    const u = await mkUser("new", "Ravi Sharma");
    const res = await provisionSelfServeOrgCore(u.id, { displayName: u.name, email: u.email, ip: `single-${stamp}` });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    orgIds.push(res.orgId);

    const org = await prisma.organization.findUnique({ where: { id: res.orgId } });
    expect(org?.source).toBe("self_serve");
    expect(org?.status).toBe("active");

    const member = await prisma.orgMember.findFirst({ where: { organizationId: res.orgId, userId: u.id } });
    expect(member?.role).toBe("consultant");
    expect(member?.status).toBe("active");
    expect(member?.isBillableSeat).toBe(true);

    const user = await prisma.user.findUnique({ where: { id: u.id }, select: { role: true } });
    expect(user?.role).toBe("consultant");

    const sub = await prisma.subscription.findUnique({ where: { orgId: res.orgId }, include: { plan: true } });
    expect(sub?.status).toBe("active");
    expect(sub?.plan.price).toBe(0);
    expect(sub?.seatCount).toBe(1);
  });

  it("uses a valid + available ?claim slug", async () => {
    const u = await mkUser("claim");
    const claim = `myhandle-${stamp}`;
    const res = await provisionSelfServeOrgCore(u.id, { claimSlug: claim, email: u.email, ip: `claim-${stamp}` });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    orgIds.push(res.orgId);
    const org = await prisma.organization.findUnique({ where: { id: res.orgId }, select: { slug: true } });
    expect(org?.slug).toBe(claim);
  });

  it("falls back to a generated slug when the claim is reserved", async () => {
    const u = await mkUser("reserved", "Priya Verma");
    const res = await provisionSelfServeOrgCore(u.id, { claimSlug: "dashboard", displayName: u.name, email: u.email, ip: `reserved-${stamp}` });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    orgIds.push(res.orgId);
    const org = await prisma.organization.findUnique({ where: { id: res.orgId }, select: { slug: true } });
    expect(org?.slug).not.toBe("dashboard");
    expect(org?.slug?.startsWith("priya")).toBe(true);
  });

  it("is idempotent — a second call returns the same org, never a duplicate", async () => {
    const u = await mkUser("dupe");
    const first = await provisionSelfServeOrgCore(u.id, { email: u.email, ip: `dupe-${stamp}` });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    orgIds.push(first.orgId);
    const second = await provisionSelfServeOrgCore(u.id, { email: u.email, ip: `dupe-${stamp}` });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(false);
    expect(second.orgId).toBe(first.orgId);
    const count = await prisma.organization.count({ where: { ownerUserId: u.id } });
    expect(count).toBe(1);
  });

  it("rate-limits org creation per IP", async () => {
    const ip = `ip-${stamp}`;
    const results = [];
    for (let i = 0; i < 6; i++) {
      const u = await mkUser(`rl-${i}`);
      const r = await provisionSelfServeOrgCore(u.id, { email: u.email, ip });
      if (r.ok) orgIds.push(r.orgId);
      results.push(r);
    }
    // Cap is 5/IP/hour → the 6th is blocked.
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].ok).toBe(false);
    if (!results[5].ok) expect(results[5].reason).toBe("rate_limited");
  });

  it("persists coachingSeen as a mergeable JSON map", async () => {
    const u = await mkUser("coach");
    await prisma.user.update({ where: { id: u.id }, data: { coachingSeen: { dashboard: true } } });
    const a = await prisma.user.findUnique({ where: { id: u.id }, select: { coachingSeen: true } });
    expect((a?.coachingSeen as Record<string, boolean>).dashboard).toBe(true);
    const merged = { ...(a?.coachingSeen as Record<string, boolean>), packages: true };
    await prisma.user.update({ where: { id: u.id }, data: { coachingSeen: merged } });
    const b = await prisma.user.findUnique({ where: { id: u.id }, select: { coachingSeen: true } });
    expect((b?.coachingSeen as Record<string, boolean>).dashboard).toBe(true);
    expect((b?.coachingSeen as Record<string, boolean>).packages).toBe(true);
  });
});
