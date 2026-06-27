import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Mock only the Google network calls; keep everything else real.
vi.mock("@/lib/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/google-oauth")>();
  return { ...actual, freeBusy: vi.fn(), refreshAccessToken: vi.fn() };
});

import { prisma } from "../lib/db";
import { isEncryptionConfigured } from "../lib/crypto";
import { freeBusy, refreshAccessToken } from "../lib/google-oauth";
import { getAvailableSlots } from "../lib/scheduling";
import { saveCalendarConnectionCore } from "../lib/calendar";
import { getBusyIntervals, invalidateMemberBusyCache, __resetBusyCache } from "../lib/calendar-freebusy";

const ready = Boolean(process.env.DATABASE_URL) && isEncryptionConfigured();
const d = ready ? describe : describe.skip;
const PREFIX = "fb-test-";
const PAST = new Date("2026-06-01T00:00:00Z"); // far before 2026-07-01 → minNotice satisfied
const SLOT_05 = "2026-07-01T05:00:00.000Z"; // 10:30 IST — a normal slot in the Wed 09:00–13:00 window
const busy = (startISO: string, endISO: string) => ({ start: new Date(startISO), end: new Date(endISO) });

d("calendar free/busy in slot computation (T-1.2)", () => {
  const stamp = Date.now();
  let orgId = "";
  let userId = "";
  let memberA = ""; // connected calendar
  let memberB = ""; // a second connected member (multi-member)
  let pkgId = "";

  async function makeSchedule(hostId: string) {
    const s = await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", ownerMemberId: hostId } });
    await prisma.availabilityRule.create({ data: { organizationId: orgId, scheduleId: s.id, weekday: 3, startTime: "09:00", endTime: "13:00" } });
    return s.id;
  }
  const slots = (hosts: string[]) => getAvailableSlots(orgId, { packageId: pkgId, hostMemberIds: hosts, fromISO: "2026-07-01", toISO: "2026-07-01", now: PAST });

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "FB", slug: `${PREFIX}${stamp}`, status: "active" } });
    orgId = org.id;
    const user = await prisma.user.create({ data: { email: `${PREFIX}${stamp}@example.com`, role: "consultant" } });
    userId = user.id;
    const mA = await prisma.orgMember.create({ data: { organizationId: orgId, userId, role: "consultant", status: "active" } });
    memberA = mA.id;
    const userB = await prisma.user.create({ data: { email: `${PREFIX}b-${stamp}@example.com`, role: "consultant" } });
    const mB = await prisma.orgMember.create({ data: { organizationId: orgId, userId: userB.id, role: "team_consulting", status: "active" } });
    memberB = mB.id;

    const scheduleId = await makeSchedule(memberA);
    await makeSchedule(memberB);
    await makeSchedule("host-nocal"); // a host with availability but NO calendar integration

    const pkg = await prisma.package.create({
      data: { organizationId: orgId, title: "Reading", slug: "reading", allowedDurations: [30], defaultDurationMin: 30, price: 100000, slotIntervalMin: 30, scheduleId },
    });
    pkgId = pkg.id;

    // Distinct access tokens so the freeBusy mock can tell the two members apart.
    const future = new Date(Date.now() + 60 * 60_000);
    await saveCalendarConnectionCore(orgId, memberA, { accessToken: "AT_A", refreshToken: "RT_A", expiresAt: future, calendarId: "primary" }, userId);
    await saveCalendarConnectionCore(orgId, memberB, { accessToken: "AT_B", refreshToken: "RT_B", expiresAt: future, calendarId: "primary" }, userId);
  });

  afterAll(async () => {
    await prisma.calendarIntegration.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades schedules/members/etc.
    await prisma.auditLog.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    __resetBusyCache();
    (freeBusy as Mock).mockReset();
    (refreshAccessToken as Mock).mockReset();
    (freeBusy as Mock).mockResolvedValue([]); // default: no external events
  });

  it("a Google busy interval blocks exactly the overlapping slot", async () => {
    (freeBusy as Mock).mockResolvedValue([busy(SLOT_05, "2026-07-01T05:30:00Z")]);
    const out = (await slots([memberA])).map((s) => s.toISOString());
    expect(out).not.toContain(SLOT_05);
    expect(out).toHaveLength(7); // 8 platform slots − 1 blocked
  });

  it("a non-overlapping event does not block other slots", async () => {
    (freeBusy as Mock).mockResolvedValue([busy("2026-07-01T08:00:00Z", "2026-07-01T09:00:00Z")]); // after the window
    expect(await slots([memberA])).toHaveLength(8);
  });

  it("graceful degradation: a calendar API failure returns all platform slots", async () => {
    (freeBusy as Mock).mockResolvedValue(null); // simulate network / 401 / rate limit
    expect(await slots([memberA])).toHaveLength(8);
  });

  it("no calendar connected → unchanged behavior + freeBusy never called", async () => {
    const out = await slots(["host-nocal"]);
    expect(out).toHaveLength(8);
    expect(freeBusy).not.toHaveBeenCalled();
  });

  it("caches free/busy: a second load within the TTL makes no new API call", async () => {
    (freeBusy as Mock).mockResolvedValue([busy(SLOT_05, "2026-07-01T05:30:00Z")]);
    await slots([memberA]);
    await slots([memberA]);
    expect((freeBusy as Mock).mock.calls.length).toBe(1);
  });

  it("invalidating the member cache forces a fresh fetch next load", async () => {
    (freeBusy as Mock).mockResolvedValue([busy(SLOT_05, "2026-07-01T05:30:00Z")]);
    await slots([memberA]);
    invalidateMemberBusyCache(memberA);
    await slots([memberA]);
    expect((freeBusy as Mock).mock.calls.length).toBe(2);
  });

  it("an expired token triggers a refresh before the free/busy call", async () => {
    // Re-connect with an already-expired token; getValidToken must refresh first.
    await saveCalendarConnectionCore(orgId, memberA, { accessToken: "STALE", refreshToken: "RT_A", expiresAt: new Date(Date.now() - 60_000), calendarId: "primary" }, userId);
    (refreshAccessToken as Mock).mockResolvedValue({ ok: true, tokens: { accessToken: "FRESH", expiresInSec: 3600 } });
    (freeBusy as Mock).mockResolvedValue([]);

    await getBusyIntervals(orgId, memberA, "2026-07-01", "2026-07-01", "Asia/Kolkata", PAST);
    expect(refreshAccessToken).toHaveBeenCalledWith("RT_A");
    expect((freeBusy as Mock).mock.calls[0][0]).toBe("FRESH"); // used the refreshed token

    // restore a valid token for any later tests
    await saveCalendarConnectionCore(orgId, memberA, { accessToken: "AT_A", refreshToken: "RT_A", expiresAt: new Date(Date.now() + 60 * 60_000), calendarId: "primary" }, userId);
  });

  it("multi-member: each host's calendar is checked independently (own token)", async () => {
    // memberA busy at 05:00, memberB free → A alone loses the slot, B keeps it.
    (freeBusy as Mock).mockImplementation(async (accessToken: string) =>
      accessToken === "AT_A" ? [busy(SLOT_05, "2026-07-01T05:30:00Z")] : [],
    );
    const aOnly = (await slots([memberA])).map((s) => s.toISOString());
    const bOnly = (await slots([memberB])).map((s) => s.toISOString());
    expect(aOnly).not.toContain(SLOT_05);
    expect(bOnly).toContain(SLOT_05);
    expect(bOnly).toHaveLength(8);
  });
});
