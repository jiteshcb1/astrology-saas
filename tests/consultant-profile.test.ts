import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  buildSocialLinks,
  completeOnboardingCore,
  getProfile,
  isValidGstin,
  isValidPhone,
  parseSpecialities,
  updateProfileCore,
} from "../lib/consultant-profile";

// ── Pure validators ─────────────────────────────────────────────────────────
describe("consultant-profile validators", () => {
  it("validates GSTIN", () => {
    expect(isValidGstin("22ABCDE1234F1Z5")).toBe(true);
    expect(isValidGstin("22abcde1234f1z5")).toBe(true); // case-insensitive
    expect(isValidGstin("ABCDE1234F1Z5")).toBe(false);
    expect(isValidGstin("22ABCDE1234F1Z")).toBe(false);
  });

  it("validates phone", () => {
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("12")).toBe(false);
    expect(isValidPhone("not a phone")).toBe(false);
  });

  it("parses specialities (trim, dedupe, drop empties)", () => {
    expect(parseSpecialities("Kundali, Career ,Kundali, ,Marriage")).toEqual(["Kundali", "Career", "Marriage"]);
    expect(parseSpecialities("")).toEqual([]);
  });

  it("builds social links from non-empty fields only", () => {
    expect(buildSocialLinks({ website: "https://x.io", instagram: "  ", youtube: undefined })).toEqual({
      website: "https://x.io",
    });
  });
});

// ── DB-backed cores ───────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "cprof-";

d("consultant-profile cores (SP-2)", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "consultant" } });
    actorId = actor.id;
    const org = await prisma.organization.create({ data: { name: "Prof Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades profile
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("completeOnboarding sets onboardedAt + audit", async () => {
    const res = await completeOnboardingCore(orgId, { displayName: "Ravi", businessType: "Astrologer", timezone: "Asia/Kolkata" }, actorId);
    expect(res.ok).toBe(true);
    const p = await getProfile(orgId);
    expect(p?.displayName).toBe("Ravi");
    expect(p?.onboardedAt).toBeTruthy();
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "profile.onboard" } })).toBeGreaterThan(0);
  });

  it("updateProfile enforces required fields, validates GST/phone, persists valid data + audit", async () => {
    // Required (everything except social + GST)
    expect((await updateProfileCore(orgId, base({ displayName: "" }), actorId)).ok).toBe(false);
    expect((await updateProfileCore(orgId, base({ bio: "" }), actorId)).ok).toBe(false);
    expect((await updateProfileCore(orgId, base({ experience: "" }), actorId)).ok).toBe(false);
    expect((await updateProfileCore(orgId, base({ specialities: [] }), actorId)).ok).toBe(false);
    expect((await updateProfileCore(orgId, base({ complaintsContactNumber: "" }), actorId)).ok).toBe(false);
    // Format
    expect((await updateProfileCore(orgId, base({ complaintsContactNumber: "xx" }), actorId)).ok).toBe(false);
    expect((await updateProfileCore(orgId, base({ gstNumber: "BADGST" }), actorId)).ok).toBe(false);

    // Valid — social + GST omitted is allowed (optional)
    const ok = await updateProfileCore(orgId, base({ gstNumber: "22ABCDE1234F1Z5" }), actorId);
    expect(ok.ok).toBe(true);
    const p = await getProfile(orgId);
    expect(p?.bio).toContain("Vedic");
    expect(p?.specialities).toEqual(["Kundali Reading"]);
    expect(p?.gstNumber).toBe("22ABCDE1234F1Z5");
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "profile.update" } })).toBeGreaterThan(0);
  });

  it("allows saving with no social links and no GST (both optional)", async () => {
    const ok = await updateProfileCore(orgId, base(), actorId);
    expect(ok.ok).toBe(true);
  });
});

function base(over: Partial<Parameters<typeof updateProfileCore>[1]> = {}) {
  return {
    displayName: "Ravi",
    bio: "Experienced Vedic astrologer",
    experience: "10 years",
    specialities: ["Kundali Reading"] as string[],
    socialLinks: {} as Record<string, string>,
    gstNumber: "",
    gstLegalName: "",
    complaintsContactNumber: "+91 9876543210",
    ...over,
  };
}
