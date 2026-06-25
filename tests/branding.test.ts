import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  contrastRatio,
  getBranding,
  INK,
  IVORY,
  MARIGOLD,
  NIGHT,
  meetsContrast,
  readableTextOn,
  resolveBrand,
  updateBrandingCore,
} from "../lib/branding";

// ── Pure contrast helpers ─────────────────────────────────────────────────────
describe("branding contrast", () => {
  it("contrastRatio: black/white ≈ 21, identical = 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeGreaterThan(20.9);
    expect(contrastRatio("#14122b", "#14122b")).toBeCloseTo(1, 5);
  });

  it("meetsContrast at AA 4.5:1 — strong colours pass, low-contrast ones fail", () => {
    for (const hex of ["#14122b", "#e8a33d", "#f6efe2"]) {
      expect(meetsContrast(hex)).toBe(true);
    }
    // Terracotta (4.18:1) and a true mid-tone (~4.0:1) don't clear AA against ink or ivory.
    expect(meetsContrast("#b9543a")).toBe(false);
    expect(meetsContrast("#767676")).toBe(false);
  });

  it("readableTextOn: ink on light, ivory on dark", () => {
    expect(readableTextOn("#f6efe2")).toBe(INK);
    expect(readableTextOn("#14122b")).toBe(IVORY);
  });

  it("resolveBrand: themeColor → primary; none → indigo; secondary always marigold", () => {
    const set = resolveBrand("#e8a33d");
    expect(set.primary).toBe("#e8a33d");
    expect(set.secondary).toBe(MARIGOLD);
    expect(set.onPrimary).toBe(readableTextOn("#e8a33d"));

    const none = resolveBrand(null);
    expect(none.primary).toBe(NIGHT);
    expect(none.onPrimary).toBe(IVORY); // ivory reads on indigo
    expect(none.secondary).toBe(MARIGOLD);
  });
});

// ── DB-backed core ──────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "brand-";

d("updateBrandingCore (SP-2.3)", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";
  const fontKey = `${PREFIX}inter-${stamp}`;

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "consultant" } });
    actorId = actor.id;
    const org = await prisma.organization.create({ data: { name: "Brand Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
    // Active catalogs: a valid colour, a low-contrast colour, and a font.
    await prisma.catalogItem.createMany({
      data: [
        { type: "theme_color", key: `${PREFIX}night-${stamp}`, label: "Night", value: { hex: "#14122b" }, sortOrder: 1 },
        { type: "theme_color", key: `${PREFIX}grey-${stamp}`, label: "Grey", value: { hex: "#767676" }, sortOrder: 2 },
        { type: "font", key: fontKey, label: "Inter", value: { script: "latin", fontFamily: "Inter" }, sortOrder: 1 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.catalogItem.deleteMany({ where: { key: { startsWith: PREFIX } } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades branding
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  const valid = { logoKey: "branding/x/logo.png", themeColor: "#14122b", fontKey, defaultLocale: "en", backgroundStyle: "stars_zodiac" };

  it("rejects a non-catalog colour", async () => {
    const r = await updateBrandingCore(orgId, { ...valid, themeColor: "#abcdef" }, actorId);
    expect(r.ok).toBe(false);
  });

  it("rejects a catalog colour that fails contrast", async () => {
    const r = await updateBrandingCore(orgId, { ...valid, themeColor: "#767676" }, actorId);
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown font key and an invalid locale", async () => {
    expect((await updateBrandingCore(orgId, { ...valid, fontKey: "no-such-font" }, actorId)).ok).toBe(false);
    expect((await updateBrandingCore(orgId, { ...valid, defaultLocale: "fr" }, actorId)).ok).toBe(false);
  });

  it("persists a valid selection + logo + audit, and preserves logo when omitted", async () => {
    const r = await updateBrandingCore(orgId, valid, actorId);
    expect(r.ok).toBe(true);
    let b = await getBranding(orgId);
    expect(b?.themeColor).toBe("#14122b");
    expect(b?.fontKey).toBe(fontKey);
    expect(b?.logoKey).toBe("branding/x/logo.png");
    expect(b?.backgroundStyle).toBe("stars_zodiac");
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "branding.update" } })).toBeGreaterThan(0);

    // Omitting logoKey leaves the existing logo intact; junk backgroundStyle falls back to default.
    const r2 = await updateBrandingCore(orgId, { themeColor: "#14122b", fontKey, defaultLocale: "hi", backgroundStyle: "rocketship" }, actorId);
    expect(r2.ok).toBe(true);
    b = await getBranding(orgId);
    expect(b?.logoKey).toBe("branding/x/logo.png");
    expect(b?.defaultLocale).toBe("hi");
    expect(b?.backgroundStyle).toBe("stars_zodiac"); // invalid → default

    // A valid non-default value persists.
    await updateBrandingCore(orgId, { themeColor: "#14122b", fontKey, defaultLocale: "en", backgroundStyle: "none" }, actorId);
    expect((await getBranding(orgId))?.backgroundStyle).toBe("none");
  });
});
