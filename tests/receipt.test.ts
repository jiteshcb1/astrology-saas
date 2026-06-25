import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getBookingReceipt } from "../lib/receipt";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "rcpt-";

d("getBookingReceipt (SP-4.4 public receipt)", () => {
  const stamp = Date.now();
  const slug = `${PREFIX}org-${stamp}`;
  let orgId = "";
  let bookingId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${PREFIX}o-${stamp}@e.com`, role: "consultant" } });
    const org = await prisma.organization.create({ data: { name: "Rcpt Org", slug, status: "active", ownerUserId: user.id } });
    orgId = org.id;
    await prisma.consultantProfile.create({ data: { organizationId: orgId, displayName: "Pandit", gstNumber: "27AAAAA0000A1Z5", onboardedAt: new Date() } });
    await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", isDefault: true } });
    const pkg = await prisma.package.create({ data: { organizationId: orgId, title: "Kundali Reading", slug: "kundali", allowedDurations: [30], defaultDurationMin: 30, price: 110000, slotIntervalMin: 30 } });
    const booking = await prisma.booking.create({ data: { organizationId: orgId, packageId: pkg.id, durationMin: 30, status: "confirmed", seekerName: "Asha", seekerEmail: "asha@e.com" } });
    bookingId = booking.id;
    await prisma.bookingSlot.create({ data: { organizationId: orgId, bookingId, hostMemberId: "h", startsAt: new Date("2026-07-01T05:00:00Z"), endsAt: new Date("2026-07-01T05:30:00Z"), active: true } });
    await prisma.receipt.create({ data: { organizationId: orgId, type: "consultation", bookingId, issuedTo: `CON-${bookingId.slice(-10)}`, gstNumberUsed: "27AAAAA0000A1Z5", amount: 110000, currency: "INR", pdfUrl: `/${slug}/book/${bookingId}/receipt` } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("returns the receipt view for a confirmed booking", async () => {
    const r = await getBookingReceipt(slug, bookingId);
    expect(r).not.toBeNull();
    expect(r!.receiptNumber).toContain("CON-");
    expect(r!.amountLabel).toContain("1,100");
    expect(r!.consultantName).toBe("Pandit");
    expect(r!.gstNumber).toBe("27AAAAA0000A1Z5");
    expect(r!.packageTitle).toBe("Kundali Reading");
    expect(r!.status).toBe("confirmed");
  });

  it("returns null for an unknown booking and for a suspended org", async () => {
    expect(await getBookingReceipt(slug, "nope")).toBeNull();
    await prisma.organization.update({ where: { id: orgId }, data: { status: "suspended" } });
    expect(await getBookingReceipt(slug, bookingId)).toBeNull();
    await prisma.organization.update({ where: { id: orgId }, data: { status: "active" } });
  });
});
