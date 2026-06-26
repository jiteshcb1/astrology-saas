import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { reconcileSeatsCore } from "../lib/seats";
import { inviteMemberCore, acceptInviteCore, removeMemberCore } from "../lib/team";
import { getDashboardSignals } from "../lib/admin-dashboard";

// SP-5.4: seatCount auto-syncs to active billable members (owner + consulting; accounts excluded). DB-gated.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "seats-";

d("per-seat billing sync (SP-5.4)", () => {
  const stamp = Date.now();
  let ownerId = "";
  let orgId = "";

  async function seatCountOf(): Promise<number> {
    return (await prisma.subscription.findUnique({ where: { orgId }, select: { seatCount: true } }))!.seatCount;
  }
  // Invite + accept a member of the given role; returns the new user id.
  async function addMember(role: "team_consulting" | "team_accounts", tag: string): Promise<string> {
    const email = `${PREFIX}${tag}-${stamp}@example.com`;
    const inv = await inviteMemberCore(orgId, { email, role }, ownerId);
    if (!inv.ok) throw new Error(`invite failed: ${inv.error}`);
    const u = await prisma.user.create({ data: { email, role: "seeker" } });
    const acc = await acceptInviteCore(inv.token, u.id);
    if (!acc.ok) throw new Error("accept failed");
    return u.id;
  }

  beforeAll(async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}owner-${stamp}@example.com`, name: "Owner", role: "consultant" } });
    ownerId = owner.id;
    const org = await prisma.organization.create({ data: { name: "Seats Org", slug: `${PREFIX}org-${stamp}`, ownerUserId: ownerId, status: "active" } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { organizationId: orgId, userId: ownerId, role: "consultant", status: "active", isBillableSeat: true } });
    const plan = await prisma.subscriptionPlan.create({ data: { name: `${PREFIX}plan-${stamp}`, price: 100000, includedSeats: 1, perSeatPrice: 50000 } });
    // Authorize 5 seats so the invite gate doesn't block; seatCount starts at the actual billable (1 = owner).
    await prisma.subscription.create({ data: { orgId, planId: plan.id, seatCount: 1, purchasedSeats: 5, status: "active" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: ownerId } });
    await prisma.$disconnect();
  });

  it("invite+accept a Consulting member → seatCount +1 (audited); Accounts member → unchanged", async () => {
    expect(await seatCountOf()).toBe(1); // owner only

    await addMember("team_consulting", "c1");
    expect(await seatCountOf()).toBe(2);
    expect(await prisma.auditLog.count({ where: { orgId, action: "subscription.seat_count_updated", metadata: { path: ["reason"], equals: "member_added" } } })).toBeGreaterThan(0);

    await addMember("team_accounts", "a1"); // NOT billable
    expect(await seatCountOf()).toBe(2);
  });

  it("removeMemberCore a Consulting member → seatCount -1", async () => {
    const before = await seatCountOf();
    const member = await prisma.orgMember.findFirst({ where: { organizationId: orgId, role: "team_consulting", status: "active" } });
    const r = await removeMemberCore(orgId, member!.id, ownerId);
    expect(r.ok).toBe(true);
    expect(await seatCountOf()).toBe(before - 1);
  });

  it("reconcileSeatsCore fixes a mismatch and is idempotent", async () => {
    await prisma.subscription.update({ where: { orgId }, data: { seatCount: 99 } }); // deliberately wrong
    const first = await reconcileSeatsCore(orgId); // scoped to this org (fast + isolated)
    expect(first.updated).toBe(1);
    const corrected = await seatCountOf(); // = actual billable (owner + any remaining consulting)
    const second = await reconcileSeatsCore(orgId);
    expect(second.updated).toBe(0); // idempotent — no change on the 2nd run
    expect(await seatCountOf()).toBe(corrected);
  });

  it("over-seat-limit → audit overLimit + super-admin signal", async () => {
    // Add a 2nd billable member while seats are authorized (gate allows: purchasedSeats=5 from setup).
    await addMember("team_consulting", "c2"); // actual billable = owner + c2 = 2
    // Simulate a downgrade below current usage: authorize 1, force a stale low seatCount so the next sync
    // re-syncs to actual (2) and detects 2 > 1 → over-limit. (The invite gate can't push past purchased.)
    await prisma.subscription.update({ where: { orgId }, data: { purchasedSeats: 1, seatCount: 1 } });
    await reconcileSeatsCore(orgId);

    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    expect(sub!.seatCount).toBeGreaterThan(sub!.purchasedSeats);
    expect(await prisma.auditLog.count({ where: { orgId, action: "subscription.seat_count_updated", metadata: { path: ["overLimit"], equals: true } } })).toBeGreaterThan(0);

    const signals = await getDashboardSignals();
    expect(signals.overSeatLimit.items.some((s) => s.orgId === orgId)).toBe(true);
  });
});
