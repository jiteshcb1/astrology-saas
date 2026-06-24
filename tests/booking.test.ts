import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { isValidEmail, isValidPhone, validateIntake, validateSeeker, type IntakeQuestion } from "../lib/booking-validate";
import { confirmBookingDetailsCore } from "../lib/booking";
import { reserveSlot } from "../lib/scheduling";

// ─── Pure validators (always run) ────────────────────────────────────────────
describe("intake validators (pure)", () => {
  const q = (over: Partial<IntakeQuestion>): IntakeQuestion => ({ id: "q", label: "L", fieldType: "short_text", requirement: "optional", options: [], ...over });

  it("validates email + phone formats", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
  });

  it("required must be filled; optional + hidden may be empty", () => {
    expect(validateIntake([q({ id: "r", requirement: "required" })], {})).toEqual({ r: "This field is required." });
    expect(validateIntake([q({ id: "o", requirement: "optional" })], {})).toEqual({});
    expect(validateIntake([q({ id: "h", requirement: "required" })].map((x) => ({ ...x, requirement: "hidden" })), {})).toEqual({});
  });

  it("checks each field type when answered", () => {
    expect(validateIntake([q({ id: "e", fieldType: "email" })], { e: "bad" }).e).toBeTruthy();
    expect(validateIntake([q({ id: "p", fieldType: "phone" })], { p: "12" }).p).toBeTruthy();
    expect(validateIntake([q({ id: "s", fieldType: "select", options: ["A", "B"] })], { s: "C" }).s).toBeTruthy();
    expect(validateIntake([q({ id: "s", fieldType: "select", options: ["A", "B"] })], { s: "A" })).toEqual({});
    expect(validateIntake([q({ id: "d", fieldType: "date" })], { d: "not-a-date" }).d).toBeTruthy();
    expect(validateIntake([q({ id: "d", fieldType: "date" })], { d: "1990-05-01" })).toEqual({});
  });

  it("validateSeeker flags missing/invalid contact", () => {
    expect(validateSeeker({ name: "", email: "x", phone: "1" })).toEqual({
      name: "Your name is required.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
    });
    expect(validateSeeker({ name: "Asha", email: "a@b.co", phone: "+91 9876543210" })).toEqual({});
  });
});

// ─── confirmBookingDetailsCore (DB-gated) ────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "bk-";
const PAST = new Date("2026-06-01T00:00:00Z");

d("confirmBookingDetailsCore", () => {
  const stamp = Date.now();
  let orgId = "";
  let pkgId = "";

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Bk Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
    await prisma.availabilitySchedule.create({ data: { organizationId: orgId, name: "WH", timezone: "Asia/Kolkata", isDefault: true } });
    const pkg = await prisma.package.create({
      data: { organizationId: orgId, title: "Reading", slug: "reading", allowedDurations: [30], defaultDurationMin: 30, price: 100000, slotIntervalMin: 30 },
    });
    pkgId = pkg.id;
    await prisma.packageQuestion.create({
      data: { organizationId: orgId, packageId: pkgId, label: "Date of birth", fieldType: "date", requirement: "required", sortOrder: 0 },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { action: { in: ["booking.hold", "booking.confirm"] }, orgId } });
    await prisma.$disconnect();
  });

  const seeker = { name: "Asha", email: "asha@example.com", phone: "+91 9876543210" };

  it("rejects when a required question is unanswered", async () => {
    const r = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "h1", startsAt: new Date("2026-07-01T04:00:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const res = await confirmBookingDetailsCore(orgId, r.bookingId, seeker, {}, PAST);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("validation");
  });

  it("saves details + answers and moves held → pending_payment", async () => {
    const r = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "h2", startsAt: new Date("2026-07-01T04:30:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const qid = (await prisma.packageQuestion.findFirst({ where: { packageId: pkgId } }))!.id;
    const res = await confirmBookingDetailsCore(orgId, r.bookingId, seeker, { [qid]: "1990-05-01" }, PAST);
    expect(res.ok).toBe(true);
    const b = await prisma.booking.findUnique({ where: { id: r.bookingId } });
    expect(b?.status).toBe("pending_payment");
    expect(b?.seekerName).toBe("Asha");
    expect(JSON.stringify(b?.answers)).toContain("1990-05-01");
  });

  it("fails safely when the hold already expired", async () => {
    const r = await reserveSlot({ orgId, packageId: pkgId, hostMemberId: "h3", startsAt: new Date("2026-07-01T05:00:00Z"), durationMin: 30, now: PAST });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const qid = (await prisma.packageQuestion.findFirst({ where: { packageId: pkgId } }))!.id;
    const later = new Date("2026-07-02T00:00:00Z"); // hold (PAST+10m) is long expired
    const res = await confirmBookingDetailsCore(orgId, r.bookingId, seeker, { [qid]: "1990-05-01" }, later);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });
});
