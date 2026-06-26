import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  hashInviteToken,
  generateInviteToken,
  inviteMemberCore,
  acceptInviteCore,
  changeRoleCore,
  removeMemberCore,
  seatUsage,
} from "../lib/team";

// ── Pure: token hashing ───────────────────────────────────────────────────────
describe("invite token", () => {
  it("hash is deterministic and never equals the raw token", () => {
    const t = generateInviteToken();
    expect(t).toHaveLength(64); // 32 bytes hex
    expect(hashInviteToken(t)).toBe(hashInviteToken(t));
    expect(hashInviteToken(t)).not.toBe(t);
  });
});

// ── DB-backed ─────────────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "team-test-";

d("team management (SP-5.1)", () => {
  const stamp = Date.now();
  let ownerId = "";
  let orgId = "";
  let planId = "";

  async function setSeats(n: number) {
    await prisma.subscription.update({ where: { orgId }, data: { seatCount: n } });
  }

  beforeAll(async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}owner-${stamp}@example.com`, name: "Owner One", role: "consultant" } });
    ownerId = owner.id;
    const org = await prisma.organization.create({ data: { name: "Team Org", slug: `${PREFIX}org-${stamp}`, ownerUserId: ownerId, status: "active" } });
    orgId = org.id;
    await prisma.orgMember.create({ data: { organizationId: orgId, userId: ownerId, role: "consultant", status: "active", isBillableSeat: true } });
    const plan = await prisma.subscriptionPlan.create({ data: { name: `${PREFIX}plan-${stamp}`, price: 100000, includedSeats: 1, perSeatPrice: 50000 } });
    planId = plan.id;
    await prisma.subscription.create({ data: { orgId, planId, seatCount: 1, status: "active" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades members/invites/subscription
    await prisma.subscriptionPlan.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: ownerId } });
    await prisma.$disconnect();
  });

  it("blocks invites when the seat limit is reached (owner alone on a 1-seat plan)", async () => {
    await setSeats(1);
    const usage = await seatUsage(orgId);
    expect(usage.limit).toBe(1);
    expect(usage.usedActive).toBe(1);
    expect(usage.remaining).toBe(0);
    const r = await inviteMemberCore(orgId, { email: `${PREFIX}a-${stamp}@example.com`, role: "team_consulting" }, ownerId);
    expect(r.ok).toBe(false);
  });

  it("rejects unknown roles and non-owner actors", async () => {
    await setSeats(3);
    expect((await inviteMemberCore(orgId, { email: `${PREFIX}b-${stamp}@example.com`, role: "team_admin" }, ownerId)).ok).toBe(false);
    expect((await inviteMemberCore(orgId, { email: `${PREFIX}c-${stamp}@example.com`, role: "team_consulting" }, "not-the-owner")).ok).toBe(false);
  });

  it("invites (pending + audited), then accept creates an active member, flips role, and is idempotent", async () => {
    await setSeats(3);
    const inv = await inviteMemberCore(orgId, { email: `${PREFIX}joiner-${stamp}@example.com`, role: "team_accounts", message: "welcome" }, ownerId);
    expect(inv.ok).toBe(true);
    if (!inv.ok) return;
    expect(await prisma.auditLog.count({ where: { actorUserId: ownerId, action: "team.invite" } })).toBeGreaterThan(0);
    const stored = await prisma.orgInvite.findUnique({ where: { id: inv.inviteId } });
    expect(stored?.status).toBe("pending");
    expect(stored?.tokenHash).toBe(hashInviteToken(inv.token));

    const joiner = await prisma.user.create({ data: { email: `${PREFIX}joiner-${stamp}@example.com`, role: "seeker" } });
    const acc = await acceptInviteCore(inv.token, joiner.id);
    expect(acc.ok).toBe(true);
    const member = await prisma.orgMember.findFirst({ where: { organizationId: orgId, userId: joiner.id, status: "active" } });
    expect(member?.role).toBe("team_accounts");
    expect((await prisma.user.findUnique({ where: { id: joiner.id } }))?.role).toBe("team_accounts");
    expect((await prisma.orgInvite.findUnique({ where: { id: inv.inviteId } }))?.status).toBe("accepted");

    // Idempotent: same token + same user again → ok, no duplicate member.
    const again = await acceptInviteCore(inv.token, joiner.id);
    expect(again.ok).toBe(true);
    expect(await prisma.orgMember.count({ where: { organizationId: orgId, userId: joiner.id } })).toBe(1);
  });

  it("rejects an expired token", async () => {
    const inv = await inviteMemberCore(orgId, { email: `${PREFIX}exp-${stamp}@example.com`, role: "team_consulting" }, ownerId);
    expect(inv.ok).toBe(true);
    if (!inv.ok) return;
    await prisma.orgInvite.update({ where: { id: inv.inviteId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const joiner = await prisma.user.create({ data: { email: `${PREFIX}exp-${stamp}@example.com`, role: "seeker" } });
    expect((await acceptInviteCore(inv.token, joiner.id)).ok).toBe(false);
  });

  it("change role updates the member + live user role; remove frees the seat", async () => {
    const inv = await inviteMemberCore(orgId, { email: `${PREFIX}cr-${stamp}@example.com`, role: "team_consulting" }, ownerId);
    expect(inv.ok).toBe(true);
    if (!inv.ok) return;
    const joiner = await prisma.user.create({ data: { email: `${PREFIX}cr-${stamp}@example.com`, role: "seeker" } });
    await acceptInviteCore(inv.token, joiner.id);
    const member = await prisma.orgMember.findFirst({ where: { organizationId: orgId, userId: joiner.id, status: "active" } });

    const cr = await changeRoleCore(orgId, member!.id, "team_accounts", ownerId);
    expect(cr.ok).toBe(true);
    expect((await prisma.user.findUnique({ where: { id: joiner.id } }))?.role).toBe("team_accounts");

    const before = (await seatUsage(orgId)).usedActive;
    const rm = await removeMemberCore(orgId, member!.id, ownerId);
    expect(rm.ok).toBe(true);
    expect((await seatUsage(orgId)).usedActive).toBe(before - 1);
    expect((await prisma.user.findUnique({ where: { id: joiner.id } }))?.role).toBe("seeker");
  });
});
