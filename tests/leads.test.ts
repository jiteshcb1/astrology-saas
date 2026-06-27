import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { isValidEmail, normalizeWhatsApp, waLink, submitLeadCore, updateLeadStatusCore, LEAD_STATUSES } from "../lib/leads";

// ── Pure (always-on) ─────────────────────────────────────────────────────────
describe("lead validators (pure)", () => {
  it("normalizes Indian WhatsApp numbers", () => {
    expect(normalizeWhatsApp("98765 43210")).toEqual({ ok: true, value: "+919876543210" });
    expect(normalizeWhatsApp("9876543210")).toEqual({ ok: true, value: "+919876543210" });
    expect(normalizeWhatsApp("+91 98765 43210")).toEqual({ ok: true, value: "+919876543210" });
    expect(normalizeWhatsApp("919876543210")).toEqual({ ok: true, value: "+919876543210" });
  });

  it("rejects invalid numbers", () => {
    expect(normalizeWhatsApp("12345").ok).toBe(false); // too short
    expect(normalizeWhatsApp("1234567890").ok).toBe(false); // starts 1 (not a mobile)
    expect(normalizeWhatsApp("+1 415 555 1234").ok).toBe(false); // non-Indian
    expect(normalizeWhatsApp("").ok).toBe(false);
  });

  it("validates email + builds wa.me links", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(waLink("+919876543210")).toBe("https://wa.me/919876543210");
    expect(waLink("9876543210")).toBe("https://wa.me/919876543210");
  });

  it("exposes the five pipeline statuses", () => {
    expect(LEAD_STATUSES).toEqual(["new", "contacted", "demo_booked", "converted", "not_interested"]);
  });
});

// ── DB-gated ─────────────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("submitLeadCore + updateLeadStatusCore (DB)", () => {
  const stamp = Date.now();
  const tag = `lead-test-${stamp}`;
  let actor = "test-actor";

  beforeAll(async () => {
    const sa = await prisma.user.findFirst({ where: { role: "super_admin" }, select: { id: true } });
    if (sa) actor = sa.id; // real id so the audit-log write is FK-safe
  });
  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { email: { contains: tag } } });
    await prisma.$disconnect();
  });

  it("creates a new lead, then dedupes by email (no second row)", async () => {
    const email = `${tag}-a@example.com`;
    const r1 = await submitLeadCore({ name: "Aarav", email, whatsapp: "98765 43210" }, null);
    expect(r1.ok && r1.isRepeat === false).toBe(true);

    const r2 = await submitLeadCore({ name: "Aarav S", email, whatsapp: "9000000009", message: "hello" }, null);
    expect(r2.ok && r2.isRepeat === true).toBe(true);

    const rows = await prisma.lead.findMany({ where: { email } });
    expect(rows).toHaveLength(1);
    expect(rows[0].whatsapp).toBe("+919000000009"); // refreshed
    expect(rows[0].message).toBe("hello");
    expect(rows[0].status).toBe("new");
  });

  it("rate-limits at 3 submissions per IP per hour", async () => {
    const ip = `9.${(stamp >> 16) % 256}.${(stamp >> 8) % 256}.${stamp % 256}`;
    for (let i = 0; i < 3; i++) {
      const r = await submitLeadCore({ name: "R", email: `${tag}-r${i}@example.com`, whatsapp: "9876543210" }, ip);
      expect(r.ok).toBe(true);
    }
    const r4 = await submitLeadCore({ name: "R", email: `${tag}-r4@example.com`, whatsapp: "9876543210" }, ip);
    expect(r4.ok).toBe(false);
    if (!r4.ok) expect(r4.error).toBe("rate_limited");
  });

  it("updates status (valid) and rejects an invalid status", async () => {
    const r = await submitLeadCore({ name: "Status", email: `${tag}-s@example.com`, whatsapp: "9876543210" }, null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const ok = await updateLeadStatusCore(r.lead.id, "contacted", actor);
    expect(ok.ok).toBe(true);
    const after = await prisma.lead.findUnique({ where: { id: r.lead.id } });
    expect(after?.status).toBe("contacted");

    const bad = await updateLeadStatusCore(r.lead.id, "bogus", actor);
    expect(bad.ok).toBe(false);
  });
});
