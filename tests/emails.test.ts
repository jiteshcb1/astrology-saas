import { describe, expect, it } from "vitest";
import {
  consultantFrom,
  otpEmail,
  bookingConfirmedEmail,
  proofReceivedEmail,
  bookingDeclinedEmail,
  newBookingConsultantEmail,
  consultantWelcomeEmail,
} from "../lib/emails";

// Pure template builders — always run (no DB). Every email must carry subject + html + a text fallback
// and put the critical info in the body.
describe("email templates (pure)", () => {
  it("consultantFrom composes a display-name sender from the base EMAIL_FROM", () => {
    expect(consultantFrom("Pandit Astrology", "Astro Consultancy <bookings@mail.hifiai.in>")).toBe(
      "Pandit Astrology via Astro <bookings@mail.hifiai.in>",
    );
    // strips angle brackets / quotes from the name; falls back if base has no <addr>
    expect(consultantFrom('Evil <x>"', "x@y.z")).toBe("Evil x via Astro <x@y.z>");
  });

  it("OTP email makes the code the hero (subject + html + text)", () => {
    const m = otpEmail("123456");
    expect(m.subject).toContain("123456");
    expect(m.html).toContain("123456");
    expect(m.text).toContain("123456");
    expect(m.text).toMatch(/10 minutes/);
  });

  it("booking confirmed carries who/when/amount + receipt CTA, and localizes", () => {
    const base = {
      consultantName: "Pandit Astrology",
      logoUrl: null,
      accent: "#14122b",
      packageTitle: "Kundali Reading",
      whenLabel: "Mon, 24 Jun 2026 · 2:30 PM",
      amountLabel: "₹1,100.00",
      receiptUrl: "https://x.test/krumos/book/b1/receipt",
    };
    const en = bookingConfirmedEmail(base);
    expect(en.subject).toContain("Pandit Astrology");
    expect(en.subject).toContain("Mon, 24 Jun 2026");
    for (const needle of ["Kundali Reading", "₹1,100.00", "receipt", base.receiptUrl]) expect(en.html).toContain(needle);
    expect(en.text).toContain("₹1,100.00");

    const hi = bookingConfirmedEmail({ ...base, locale: "hi" });
    expect(hi.subject).not.toBe(en.subject); // copy changes by locale
    expect(hi.html).toContain("कन्फर्म");
  });

  it("proof-received, declined, new-booking, welcome all have subject + html + text", () => {
    const seeker = { consultantName: "Pandit", logoUrl: null, accent: null, packageTitle: "Reading", whenLabel: "soon" };
    const all = [
      proofReceivedEmail(seeker),
      bookingDeclinedEmail({ ...seeker, rebookUrl: "https://x.test/krumos", contact: "+91 99999 99999" }),
      newBookingConsultantEmail({ seekerName: "Asha", packageTitle: "Reading", whenLabel: "soon", amountLabel: "₹500.00", mode: "upi_qr", bookingsUrl: "https://x.test/dashboard/bookings" }),
      consultantWelcomeEmail({ orgName: "Krumos", signInUrl: "https://x.test/signin" }),
    ];
    for (const m of all) {
      expect(m.subject.length).toBeGreaterThan(0);
      expect(m.html).toContain("<html");
      expect(m.text.length).toBeGreaterThan(0);
    }
    // the consultant-facing new-booking (UPI) prompts verification
    expect(newBookingConsultantEmail({ seekerName: "Asha", packageTitle: "R", whenLabel: "x", amountLabel: "₹1.00", mode: "upi_qr", bookingsUrl: "u" }).subject).toMatch(/verify/i);
  });

  it("escapes HTML in interpolated user content", () => {
    const m = bookingConfirmedEmail({ consultantName: "A & <b>", logoUrl: null, accent: null, packageTitle: "<script>", whenLabel: "x", amountLabel: "₹1.00", receiptUrl: "u" });
    expect(m.html).toContain("&amp;");
    expect(m.html).not.toContain("<script>");
  });
});
