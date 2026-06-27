import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { bookingConfirmedEmail, newBookingConsultantEmail } from "../lib/emails";
import { buildAddToCalendarUrl } from "../lib/notifications";
import { getOwnerUpcoming } from "../lib/consultant-home";

const MEET = "https://meet.google.com/abc-defg-hij";

// ── Pure email render (T-1.4) ──────────────────────────────────────────────────
describe("meet-link wiring — emails + calendar url", () => {
  const base = { consultantName: "Pandit", packageTitle: "Reading", whenLabel: "Mon 1 Jul, 10:30", amountLabel: "₹500", receiptUrl: "https://x.test/receipt" };

  it("booking confirmation shows a Join CTA + copyable link when present", () => {
    const m = bookingConfirmedEmail({ ...base, meetLink: MEET });
    expect(m.html).toContain(MEET);
    expect(m.html).toContain("Join the video call");
    expect(m.html).toContain("Or copy this link");
    expect(m.text).toContain(`Join the video call: ${MEET}`);
  });

  it("booking confirmation shows the calm stub and no link when null", () => {
    const m = bookingConfirmedEmail({ ...base, meetLink: null });
    expect(m.html).toContain("Your consultant will send the call link before the session.");
    expect(m.html).not.toContain("meet.google.com");
  });

  it("consultant new-booking email reflects calendar status", () => {
    const withLink = newBookingConsultantEmail({ seekerName: "Meena", packageTitle: "Reading", whenLabel: "Mon", amountLabel: "₹500", mode: "gateway", bookingsUrl: "https://x.test/b", meetLink: MEET });
    expect(withLink.html).toContain("Added to Google Calendar");
    expect(withLink.html).toContain(MEET);

    const noLink = newBookingConsultantEmail({ seekerName: "Meena", packageTitle: "Reading", whenLabel: "Mon", amountLabel: "₹500", mode: "upi_qr", bookingsUrl: "https://x.test/b", meetLink: null });
    expect(noLink.html).toContain("Remember to send the seeker a call link");
    expect(noLink.html).not.toContain("meet.google.com");
  });

  it("add-to-calendar URL carries the Meet link as location + details", () => {
    const start = new Date("2026-07-01T05:00:00Z");
    const end = new Date("2026-07-01T05:30:00Z");
    const withLink = buildAddToCalendarUrl("Reading with Pandit", start, end, MEET);
    expect(withLink).toContain("location=Google%20Meet");
    expect(withLink).toContain("details=");
    expect(decodeURIComponent(withLink)).toContain(`Join: ${MEET}`);

    const noLink = buildAddToCalendarUrl("Reading with Pandit", start, end, null);
    expect(noLink).not.toContain("location=");
  });
});

// ── DB-gated: getOwnerUpcoming returns meetLink ────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "meetwire-";

d("owner upcoming surfaces the Meet link", () => {
  const stamp = Date.now();
  let orgId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "MW", slug: `${PREFIX}${stamp}`, status: "active" } });
    orgId = org.id;
    const pkg = await prisma.package.create({ data: { organizationId: orgId, title: "Reading", slug: `r-${stamp}`, allowedDurations: [30], defaultDurationMin: 30, price: 50000, isActive: true } });
    const booking = await prisma.booking.create({ data: { organizationId: orgId, packageId: pkg.id, durationMin: 30, status: "confirmed", seekerName: "Seeker", meetLink: MEET } });
    const start = new Date("2026-12-01T05:00:00Z"); // safely in the future
    await prisma.bookingSlot.create({ data: { organizationId: orgId, bookingId: booking.id, hostMemberId: "h1", startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000), active: true } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("includes meetLink on the upcoming row", async () => {
    const { rows } = await getOwnerUpcoming(orgId, new Date("2026-06-01T00:00:00Z"));
    expect(rows).toHaveLength(1);
    expect(rows[0].meetLink).toBe(MEET);
  });
});
