import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { claimHoldForPayment, expireHoldsCore, getAvailableSlots, reserveSlot } from "../lib/scheduling";

// The engine's hard guarantees need a real Postgres (the GiST exclusion constraint). DB-gated.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "sched-";
const PAST = new Date("2026-06-01T00:00:00Z");

d("scheduling engine (SP-3)", () => {
  const stamp = Date.now();
  let orgId = "";
  let pkgId = "";
  let scheduleId = "";

  // SP-5.2: schedules are per-host (ownerMemberId). Each host that's queried via getAvailableSlots needs one;
  // reserveSlot-only hosts don't (reserveSlot just inserts a slot, GiST-guarded). Wednesday 09:00–13:00 IST.
  async function makeSchedule(hostId: string): Promise<string> {
    const s = await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", ownerMemberId: hostId } });
    await prisma.availabilityRule.create({ data: { organizationId: orgId, scheduleId: s.id, weekday: 3, startTime: "09:00", endTime: "13:00" } });
    return s.id;
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Sched Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
    scheduleId = await makeSchedule("host-A");
    const pkg = await prisma.package.create({
      data: {
        organizationId: orgId,
        title: "Reading",
        slug: "reading",
        allowedDurations: [15, 30, 45, 60],
        defaultDurationMin: 30,
        price: 100000,
        slotIntervalMin: 30,
        scheduleId,
      },
    });
    pkgId = pkg.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades all
    await prisma.auditLog.deleteMany({ where: { action: { in: ["booking.create", "booking.hold"] }, orgId } });
    await prisma.$disconnect();
  });

  it("computes slots from availability and excludes a booked window", async () => {
    const slots = await getAvailableSlots(orgId, {
      packageId: pkgId,
      hostMemberIds: ["host-A"],
      fromISO: "2026-07-01",
      toISO: "2026-07-01",
      now: PAST,
    });
    // 09:00–13:00 IST (03:30–07:30Z), 30-min step, 30-min duration → 8 starts.
    expect(slots).toHaveLength(8);
    expect(slots[0].toISOString()).toBe("2026-07-01T03:30:00.000Z");

    // Book 10:30 IST (05:00Z) for host-A, then re-query: that start disappears.
    const r = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-A", startsAt: new Date("2026-07-01T05:00:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    const after = await getAvailableSlots(orgId, { packageId: pkgId, hostMemberIds: ["host-A"], fromISO: "2026-07-01", toISO: "2026-07-01", now: PAST });
    expect(after.map((s) => s.toISOString())).not.toContain("2026-07-01T05:00:00.000Z");
    expect(after).toHaveLength(7);
  });

  it("CONCURRENCY: two overlapping reservations → exactly one wins (DB exclusion constraint)", async () => {
    const startsAt = new Date("2026-07-01T06:00:00Z"); // 11:30 IST
    const [a, b] = await Promise.all([
      reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-RACE", startsAt, durationMin: 30, now: PAST }),
      reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-RACE", startsAt, durationMin: 30, now: PAST }),
    ]);
    expect([a, b].filter((r) => r.ok).length).toBe(1);
    expect([a, b].some((r) => !r.ok && r.reason === "slot_taken")).toBe(true);
  });

  it("VARIABLE DURATIONS: an overlapping 15-min vs 60-min for the same host is rejected", async () => {
    const r60 = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-VD", startsAt: new Date("2026-07-01T04:00:00Z"), durationMin: 60, now: PAST });
    expect(r60.ok).toBe(true); // 04:00–05:00Z
    const r15 = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-VD", startsAt: new Date("2026-07-01T04:15:00Z"), durationMin: 15, now: PAST });
    expect(r15.ok).toBe(false);
    if (!r15.ok) expect(r15.reason).toBe("slot_taken");
  });

  it("different hosts and adjacent ranges both succeed", async () => {
    const start = new Date("2026-07-01T04:00:00Z");
    const sameWindowOtherHost = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-OTHER", startsAt: start, durationMin: 60, now: PAST });
    expect(sameWindowOtherHost.ok).toBe(true); // different host → no clash
    const adjacent = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-VD", startsAt: new Date("2026-07-01T05:00:00Z"), durationMin: 30, now: PAST });
    expect(adjacent.ok).toBe(true); // [05:00,05:30) touches but doesn't overlap [04:00,05:00)
  });

  it("respects minimum notice", async () => {
    const pkg = await prisma.package.create({
      data: { organizationId: orgId, title: "Notice", slug: "notice", allowedDurations: [30], defaultDurationMin: 30, price: 0, slotIntervalMin: 30, minNoticeMin: 120, scheduleId },
    });
    await makeSchedule("host-N");
    const now = new Date("2026-07-01T03:30:00Z"); // 09:00 IST; notBefore = 11:00 IST (05:30Z)
    const slots = await getAvailableSlots(orgId, { packageId: pkg.id, hostMemberIds: ["host-N"], fromISO: "2026-07-01", toISO: "2026-07-01", now });
    expect(slots.every((s) => s.getTime() >= new Date("2026-07-01T05:30:00Z").getTime())).toBe(true);
    expect(slots[0].toISOString()).toBe("2026-07-01T05:30:00.000Z");
  });

  // ─── SP-4.2 hold / expiry / anti-race ──────────────────────────────────────
  it("HOLD EXPIRY: an expired hold no longer blocks — slot is free again and re-holdable (lazy)", async () => {
    await makeSchedule("host-EXP");
    const start = new Date("2026-07-01T04:30:00Z"); // 10:00 IST, inside the window
    // now=PAST → holdExpiresAt = PAST + 10min, i.e. long expired relative to 2026-07-02.
    const r1 = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-EXP", startsAt: start, durationMin: 30, now: PAST });
    expect(r1.ok).toBe(true);

    // `later` is after the hold's PAST+10min expiry but before the slot date (so minNotice keeps 07-01 slots).
    const later = new Date("2026-06-15T00:00:00Z");
    const slots = await getAvailableSlots(orgId, { packageId: pkgId, hostMemberIds: ["host-EXP"], fromISO: "2026-07-01", toISO: "2026-07-01", now: later });
    expect(slots.map((s) => s.toISOString())).toContain("2026-07-01T04:30:00.000Z"); // expired hold doesn't block

    const r2 = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-EXP", startsAt: start, durationMin: 30, now: later });
    expect(r2.ok).toBe(true); // lazy expiry freed the stale hold, fresh hold takes it
    if (r1.ok) {
      const old = await prisma.booking.findUnique({ where: { id: r1.bookingId } });
      expect(old?.status).toBe("expired");
    }
  });

  it("ANTI-RACE: claim (payment) and sweep (expiry) are mutually exclusive on the same hold", async () => {
    const T0 = new Date("2026-07-01T08:00:00Z");
    const mid = new Date("2026-07-01T08:05:00Z"); // before holdExpiresAt (T0+10)
    const late = new Date("2026-07-01T08:30:00Z"); // after holdExpiresAt

    // Case A — hold still valid: claim wins, sweep skips it.
    const a = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-ARA", startsAt: new Date("2026-07-01T09:00:00Z"), durationMin: 30, now: T0 });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const [claimA] = await Promise.all([claimHoldForPayment(orgId, a.bookingId, mid), expireHoldsCore(mid, orgId)]);
    expect(claimA.ok).toBe(true);
    expect((await prisma.booking.findUnique({ where: { id: a.bookingId } }))?.status).toBe("confirming");

    // Case B — hold lapsed: sweep wins, claim fails safely (don't charge).
    const b = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "host-ARB", startsAt: new Date("2026-07-01T09:30:00Z"), durationMin: 30, now: T0 });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    const [claimB] = await Promise.all([claimHoldForPayment(orgId, b.bookingId, late), expireHoldsCore(late, orgId)]);
    expect(claimB.ok).toBe(false);
    const bookingB = await prisma.booking.findUnique({ where: { id: b.bookingId } });
    expect(bookingB?.status).toBe("expired");
  });

  it("respects a per-day frequency cap", async () => {
    const pkg = await prisma.package.create({
      data: { organizationId: orgId, title: "Capped", slug: "capped", allowedDurations: [30], defaultDurationMin: 30, price: 0, slotIntervalMin: 30, freqLimit: { per_day: 1 }, scheduleId },
    });
    await makeSchedule("host-CAP");
    // Book one slot for host-CAP that day → cap reached → no slots offered.
    const r = await reserveSlot({ orgId, packageId: pkg.id, hostMemberId: "host-CAP", startsAt: new Date("2026-07-01T03:30:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    const slots = await getAvailableSlots(orgId, { packageId: pkg.id, hostMemberIds: ["host-CAP"], fromISO: "2026-07-01", toISO: "2026-07-01", now: PAST });
    expect(slots).toHaveLength(0);
  });
});
