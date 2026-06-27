import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Mock the Google event API; keep everything else real.
vi.mock("@/lib/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/google-oauth")>();
  return { ...actual, createCalendarEvent: vi.fn(), deleteCalendarEvent: vi.fn(), refreshAccessToken: vi.fn() };
});

import { prisma } from "../lib/db";
import { isEncryptionConfigured } from "../lib/crypto";
import { createCalendarEvent, deleteCalendarEvent } from "../lib/google-oauth";
import { saveCalendarConnectionCore } from "../lib/calendar";
import { ensureMeetLink, deleteBookingCalendarEvent } from "../lib/calendar-events";

const ready = Boolean(process.env.DATABASE_URL) && isEncryptionConfigured();
const d = ready ? describe : describe.skip;
const PREFIX = "evt-test-";
const MEET = "https://meet.google.com/abc-defg-hij";

d("Meet-link generation on confirmation (T-1.3)", () => {
  const stamp = Date.now();
  let orgId = "";
  let userId = "";
  let memberCal = ""; // connected calendar
  let memberNoCal = ""; // no calendar
  let pkgId = "";
  let n = 0;

  async function makeConfirmedBooking(hostId: string): Promise<string> {
    const start = new Date(`2026-07-01T0${n++}:00:00Z`); // distinct per booking (avoid slot overlap)
    const b = await prisma.booking.create({
      data: { organizationId: orgId, packageId: pkgId, assignedMemberId: hostId, durationMin: 30, status: "confirmed", seekerName: "Seeker", seekerEmail: "seeker@example.com" },
    });
    await prisma.bookingSlot.create({ data: { organizationId: orgId, bookingId: b.id, hostMemberId: hostId, startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000), active: true } });
    return b.id;
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Evt", slug: `${PREFIX}${stamp}`, status: "active" } });
    orgId = org.id;
    const user = await prisma.user.create({ data: { email: `${PREFIX}${stamp}@example.com`, role: "consultant" } });
    userId = user.id;
    memberCal = (await prisma.orgMember.create({ data: { organizationId: orgId, userId, role: "consultant", status: "active" } })).id;
    const u2 = await prisma.user.create({ data: { email: `${PREFIX}n-${stamp}@example.com`, role: "consultant" } });
    memberNoCal = (await prisma.orgMember.create({ data: { organizationId: orgId, userId: u2.id, role: "team_consulting", status: "active" } })).id;
    pkgId = (await prisma.package.create({ data: { organizationId: orgId, title: "Reading", slug: "reading", allowedDurations: [30], defaultDurationMin: 30, price: 100000, slotIntervalMin: 30 } })).id;
    await saveCalendarConnectionCore(orgId, memberCal, { accessToken: "AT", refreshToken: "RT", expiresAt: new Date(Date.now() + 60 * 60_000), calendarId: "primary", googleEmail: "host@gmail.com" }, userId);
  });

  afterAll(async () => {
    await prisma.calendarIntegration.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    (createCalendarEvent as Mock).mockReset();
    (deleteCalendarEvent as Mock).mockReset();
    (createCalendarEvent as Mock).mockResolvedValue({ id: "evt_1", meetLink: MEET });
    (deleteCalendarEvent as Mock).mockResolvedValue({ ok: true });
  });

  it("connected calendar → stores meetLink + calendarEventId, audits, passes requestId", async () => {
    const bookingId = await makeConfirmedBooking(memberCal);
    await ensureMeetLink(orgId, bookingId);

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.meetLink).toBe(MEET);
    expect(b.calendarEventId).toBe("evt_1");
    // requestId = booking id (Meet-link idempotency).
    const body = (createCalendarEvent as Mock).mock.calls[0][2] as { conferenceData: { createRequest: { requestId: string } } };
    expect(body.conferenceData.createRequest.requestId).toBe(bookingId);
    expect(await prisma.auditLog.findFirst({ where: { orgId, action: "booking.meet_link.created", resourceId: bookingId } })).not.toBeNull();
  });

  it("API failure → booking stays confirmed, meetLink null (no throw)", async () => {
    const bookingId = await makeConfirmedBooking(memberCal);
    (createCalendarEvent as Mock).mockResolvedValueOnce(null);
    await ensureMeetLink(orgId, bookingId); // must not throw

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("confirmed");
    expect(b.meetLink).toBeNull();
    expect(b.calendarEventId).toBeNull();
    expect(createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it("no calendar connected → confirmed, meetLink null, no API call", async () => {
    const bookingId = await makeConfirmedBooking(memberNoCal);
    await ensureMeetLink(orgId, bookingId);

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.meetLink).toBeNull();
    expect(b.calendarEventId).toBeNull();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  it("idempotent: a second ensureMeetLink makes no duplicate event", async () => {
    const bookingId = await makeConfirmedBooking(memberCal);
    await ensureMeetLink(orgId, bookingId);
    await ensureMeetLink(orgId, bookingId); // calendarEventId already set → skip
    expect(createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it("cancellation deletes the event, clears calendarEventId, keeps meetLink", async () => {
    const bookingId = await makeConfirmedBooking(memberCal);
    await ensureMeetLink(orgId, bookingId); // sets calendarEventId = evt_1 + meetLink

    await deleteBookingCalendarEvent(orgId, bookingId, userId);
    expect(deleteCalendarEvent).toHaveBeenCalledTimes(1);
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.calendarEventId).toBeNull();
    expect(b.meetLink).toBe(MEET); // preserved for past records
    expect(await prisma.auditLog.findFirst({ where: { orgId, action: "booking.meet_link.deleted", resourceId: bookingId } })).not.toBeNull();
  });
});
