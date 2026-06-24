import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getAvailableSlots, reserveSlot } from "../lib/scheduling";

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

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Sched Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
    const schedule = await prisma.availabilitySchedule.create({
      data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", isDefault: true },
    });
    scheduleId = schedule.id;
    // Wednesday (weekday 3) 09:00–13:00 IST.
    await prisma.availabilityRule.create({
      data: { organizationId: orgId, scheduleId, weekday: 3, startTime: "09:00", endTime: "13:00" },
    });
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
    await prisma.auditLog.deleteMany({ where: { action: "booking.create", orgId } });
    await prisma.$disconnect();
  });

  it("computes slots from availability and excludes a booked window", async () => {
    const slots = await getAvailableSlots(orgId, {
      packageId: pkgId,
      hostMemberId: "host-A",
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
    const after = await getAvailableSlots(orgId, { packageId: pkgId, hostMemberId: "host-A", fromISO: "2026-07-01", toISO: "2026-07-01", now: PAST });
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
    const now = new Date("2026-07-01T03:30:00Z"); // 09:00 IST; notBefore = 11:00 IST (05:30Z)
    const slots = await getAvailableSlots(orgId, { packageId: pkg.id, hostMemberId: "host-N", fromISO: "2026-07-01", toISO: "2026-07-01", now });
    expect(slots.every((s) => s.getTime() >= new Date("2026-07-01T05:30:00Z").getTime())).toBe(true);
    expect(slots[0].toISOString()).toBe("2026-07-01T05:30:00.000Z");
  });

  it("respects a per-day frequency cap", async () => {
    const pkg = await prisma.package.create({
      data: { organizationId: orgId, title: "Capped", slug: "capped", allowedDurations: [30], defaultDurationMin: 30, price: 0, slotIntervalMin: 30, freqLimit: { per_day: 1 }, scheduleId },
    });
    // Book one slot for host-CAP that day → cap reached → no slots offered.
    const r = await reserveSlot({ orgId, packageId: pkg.id, hostMemberId: "host-CAP", startsAt: new Date("2026-07-01T03:30:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    const slots = await getAvailableSlots(orgId, { packageId: pkg.id, hostMemberId: "host-CAP", fromISO: "2026-07-01", toISO: "2026-07-01", now: PAST });
    expect(slots).toHaveLength(0);
  });
});
