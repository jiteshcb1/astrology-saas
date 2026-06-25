import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getBookingDetail, listAllBookings, listAllReceipts, resolveConsultant } from "../lib/oversight";

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

const bk = hasDb ? describe : describe.skip;
const BPREFIX = "ovr-bk-";

bk("super-admin bookings oversight", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";
  let bookingId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${BPREFIX}admin-${stamp}@example.com`, role: "super_admin" } });
    actorId = actor.id;
    const consultantUser = await prisma.user.create({ data: { email: `${BPREFIX}consultant-${stamp}@example.com`, name: "Cons Ult", phone: "+91 90000 00001", role: "consultant" } });
    const org = await prisma.organization.create({ data: { name: "Bk Org", slug: `${BPREFIX}org-${stamp}` } });
    orgId = org.id;
    const member = await prisma.orgMember.create({ data: { organizationId: orgId, userId: consultantUser.id, role: "consultant", status: "active" } });
    await prisma.consultantProfile.create({ data: { organizationId: orgId, displayName: "Astro Cons", complaintsContactNumber: "+91 90000 00002", timezone: "Asia/Kolkata" } });
    const pkg = await prisma.package.create({ data: { organizationId: orgId, title: "Kundli Call", slug: `kundli-${stamp}`, allowedDurations: [60], defaultDurationMin: 60, price: 200000, currency: "INR" } });
    const booking = await prisma.booking.create({
      data: { organizationId: orgId, packageId: pkg.id, durationMin: 60, status: "confirmed", seekerName: "Seek Er", seekerEmail: "seeker@example.com", seekerPhone: "+91 98888 00000", answers: { responses: [{ label: "Goal", value: "Career" }] }, meetLink: "https://meet.example/abc" },
    });
    bookingId = booking.id;
    await prisma.bookingSlot.create({ data: { organizationId: orgId, bookingId, hostMemberId: member.id, startsAt: new Date(stamp + 86400000), endsAt: new Date(stamp + 86400000 + 3600000) } });
    await prisma.payment.create({ data: { organizationId: orgId, bookingId, mode: "upi_qr", amount: 200000, currency: "INR", status: "success", utrReference: "UTR123" } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: BPREFIX } } }); // cascades booking/slot/payment/profile/member
    await prisma.user.deleteMany({ where: { email: { startsWith: BPREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("lists bookings cross-tenant with joined consultant/seeker/payment/slot + logs access", async () => {
    const { items } = await listAllBookings(actorId, { page: 1, pageSize: 100 });
    const row = items.find((b) => b.id === bookingId);
    expect(row).toBeTruthy();
    expect(row!.payment?.amount).toBe(200000);
    expect(row!.slot?.startsAt).toBeTruthy();
    const c = resolveConsultant(row!.organization);
    expect(c.name).toBe("Astro Cons");
    expect(c.email).toBe(`${BPREFIX}consultant-${stamp}@example.com`);
    expect(c.contact).toBe("+91 90000 00002");
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "oversight.view", resourceType: "bookings" } })).toBeGreaterThan(0);
  });

  it("getBookingDetail returns full record incl. payment + answers", async () => {
    const detail = await getBookingDetail(actorId, bookingId);
    expect(detail).toBeTruthy();
    expect(detail!.booking.seekerName).toBe("Seek Er");
    expect(detail!.booking.payment?.utrReference).toBe("UTR123");
    expect((detail!.booking.answers as { responses: unknown[] }).responses).toHaveLength(1);
    expect(await getBookingDetail(actorId, "no-such-id")).toBeNull();
  });
});
