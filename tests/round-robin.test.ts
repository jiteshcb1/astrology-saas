import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { assignAndReserveSlot, getAvailableSlots } from "../lib/scheduling";

// Round-robin host assignment (SP-5.2). Needs the real GiST constraint for the concurrency cases. DB-gated.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "rr-";
const NOW = new Date("2026-06-01T00:00:00Z"); // well before the 2026-07-01 (Wednesday) slots

async function schedule(orgId: string, memberId: string, startTime: string, endTime: string) {
  const s = await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", ownerMemberId: memberId } });
  await prisma.availabilityRule.create({ data: { organizationId: orgId, scheduleId: s.id, weekday: 3, startTime, endTime } });
}
async function makePackage(orgId: string) {
  const p = await prisma.package.create({
    data: { organizationId: orgId, title: "Reading", slug: `reading-${Date.now()}-${Math.round(NOW.getTime())}`, allowedDurations: [30], defaultDurationMin: 30, price: 0, slotIntervalMin: 30 },
  });
  return p.id;
}

d("round-robin assignment", () => {
  const stamp = Date.now();
  let orgId = "";
  let pkgId = "";
  let ownerMemberId = "";
  let bId = "";
  let cId = "";

  beforeAll(async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}owner-${stamp}@example.com`, role: "consultant" } });
    const ub = await prisma.user.create({ data: { email: `${PREFIX}b-${stamp}@example.com`, role: "team_consulting" } });
    const uc = await prisma.user.create({ data: { email: `${PREFIX}c-${stamp}@example.com`, role: "team_consulting" } });
    const org = await prisma.organization.create({ data: { name: "RR Org", slug: `${PREFIX}org-${stamp}`, ownerUserId: owner.id, status: "active" } });
    orgId = org.id;
    const om = await prisma.orgMember.create({ data: { organizationId: orgId, userId: owner.id, role: "consultant", status: "active" } });
    const mb = await prisma.orgMember.create({ data: { organizationId: orgId, userId: ub.id, role: "team_consulting", status: "active" } });
    const mc = await prisma.orgMember.create({ data: { organizationId: orgId, userId: uc.id, role: "team_consulting", status: "active" } });
    ownerMemberId = om.id;
    bId = mb.id;
    cId = mc.id;
    // Disjoint-ish hours (IST): owner 09–12, B 13–16, C 09–16 (covers all).
    await schedule(orgId, ownerMemberId, "09:00", "12:00");
    await schedule(orgId, bId, "13:00", "16:00");
    await schedule(orgId, cId, "09:00", "16:00");
    pkgId = await makePackage(orgId);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { orgId } });
    await prisma.$disconnect();
  });

  it("UNION: slots show if ANY member is free (owner-only + B-only both appear)", async () => {
    const slots = (await getAvailableSlots(orgId, { packageId: pkgId, hostMemberIds: [ownerMemberId, bId], fromISO: "2026-07-01", toISO: "2026-07-01", now: NOW })).map((d) => d.toISOString());
    expect(slots).toContain("2026-07-01T03:30:00.000Z"); // 09:00 IST — owner only
    expect(slots).toContain("2026-07-01T07:30:00.000Z"); // 13:00 IST — B only
    const ownerOnly = (await getAvailableSlots(orgId, { packageId: pkgId, hostMemberIds: [ownerMemberId], fromISO: "2026-07-01", toISO: "2026-07-01", now: NOW })).map((d) => d.toISOString());
    expect(ownerOnly).not.toContain("2026-07-01T07:30:00.000Z"); // B's slot isn't owner's
  });

  it("NO_HOST: a time outside everyone's hours → reason no_host", async () => {
    const r = await assignAndReserveSlot({ orgId, packageId: pkgId, startsAt: new Date("2026-07-01T02:00:00Z"), durationMin: 30, now: NOW }); // 07:30 IST, before 09:00
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_host");
  });

  it("METRIC: assigns the least-loaded host (owner over a loaded member)", async () => {
    // Give C a confirmed booking (load 1) at 04:00Z; owner has none. At 03:30Z eligible = owner + C → owner.
    const seed = await prisma.booking.create({ data: { organizationId: orgId, packageId: pkgId, assignedMemberId: cId, durationMin: 30, status: "confirmed" } });
    await prisma.bookingSlot.create({ data: { organizationId: orgId, bookingId: seed.id, hostMemberId: cId, startsAt: new Date("2026-07-01T04:00:00Z"), endsAt: new Date("2026-07-01T04:30:00Z"), active: true } });

    const r = await assignAndReserveSlot({ orgId, packageId: pkgId, startsAt: new Date("2026-07-01T03:30:00Z"), durationMin: 30, now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const booking = await prisma.booking.findUnique({ where: { id: r.bookingId } });
    expect(booking?.assignedMemberId).toBe(ownerMemberId);
  });

  it("CONCURRENCY (two free hosts): both succeed with different hosts", async () => {
    const startsAt = new Date("2026-07-01T05:00:00Z"); // 10:30 IST — owner (09–12) + C (09–16) free; B not
    const [a, b] = await Promise.all([
      assignAndReserveSlot({ orgId, packageId: pkgId, startsAt, durationMin: 30, now: NOW }),
      assignAndReserveSlot({ orgId, packageId: pkgId, startsAt, durationMin: 30, now: NOW }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const [ba, bb] = await Promise.all([
      prisma.booking.findUnique({ where: { id: a.bookingId } }),
      prisma.booking.findUnique({ where: { id: b.bookingId } }),
    ]);
    expect(ba?.assignedMemberId).not.toBe(bb?.assignedMemberId); // different hosts
  });

  it("CONCURRENCY (one free host): exactly one wins, the other is slot_taken", async () => {
    const startsAt = new Date("2026-07-01T06:30:00Z"); // 12:00 IST — only C (09–16) is free
    const [a, b] = await Promise.all([
      assignAndReserveSlot({ orgId, packageId: pkgId, startsAt, durationMin: 30, now: NOW }),
      assignAndReserveSlot({ orgId, packageId: pkgId, startsAt, durationMin: 30, now: NOW }),
    ]);
    expect([a, b].filter((r) => r.ok).length).toBe(1);
    expect([a, b].some((r) => !r.ok && r.reason === "slot_taken")).toBe(true);
  });

  it("SINGLE-MEMBER (owner only): behaves like single-host", async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}solo-${stamp}@example.com`, role: "consultant" } });
    const org = await prisma.organization.create({ data: { name: "Solo", slug: `${PREFIX}solo-${stamp}`, ownerUserId: owner.id, status: "active" } });
    const om = await prisma.orgMember.create({ data: { organizationId: org.id, userId: owner.id, role: "consultant", status: "active" } });
    await schedule(org.id, om.id, "09:00", "13:00");
    const pkg = await makePackage(org.id);
    const r = await assignAndReserveSlot({ orgId: org.id, packageId: pkg, startsAt: new Date("2026-07-01T03:30:00Z"), durationMin: 30, now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const booking = await prisma.booking.findUnique({ where: { id: r.bookingId } });
    expect(booking?.assignedMemberId).toBe(om.id);
  });
});
