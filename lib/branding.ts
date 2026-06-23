import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { getActiveCatalog } from "@/lib/catalog";

// Consultant public-page branding. Tenant-scoped via tenantDb(orgId).orgBranding.
// themeColor/fontKey are constrained to the active theme_color/font catalogs at write time
// (no free-form). Pure contrast helpers are unit-tested; the core runs through
// tenantTransaction + writeAuditLog. logoKey is the R2 object key (resolved to a URL on read).

export const INK = "#14122b";
export const IVORY = "#f6efe2";
export const LOCALES = ["en", "hi", "hinglish"] as const;
export type Locale = (typeof LOCALES)[number];

// ── WCAG contrast (pure) ─────────────────────────────────────────────────────
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Whichever of ink / ivory reads best on the given background.
export function readableTextOn(bg: string): string {
  return contrastRatio(bg, INK) >= contrastRatio(bg, IVORY) ? INK : IVORY;
}

// A theme colour is acceptable if its best text choice clears the threshold.
export function meetsContrast(bg: string, min = 4.5): boolean {
  return Math.max(contrastRatio(bg, INK), contrastRatio(bg, IVORY)) >= min;
}

export function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

// ── Data access + core ───────────────────────────────────────────────────────
export type BrandingResult = { ok: true } | { ok: false; error: string };
export type BrandingFormState = { error?: string; ok?: boolean };

export async function getBranding(orgId: string) {
  return tenantDb(orgId).orgBranding.findFirst();
}

export interface BrandingInput {
  logoKey?: string | null; // only persisted when provided (undefined = leave as-is)
  themeColor: string;
  fontKey: string;
  defaultLocale: string;
}

export async function updateBrandingCore(
  orgId: string,
  input: BrandingInput,
  actorUserId: string,
): Promise<BrandingResult> {
  const [colors, fonts] = await Promise.all([
    getActiveCatalog("theme_color"),
    getActiveCatalog("font"),
  ]);

  const allowedHexes = new Set(
    colors.map((c) => normalizeHex((c.value as { hex?: string }).hex ?? "")).filter(Boolean),
  );
  const allowedFontKeys = new Set(fonts.map((f) => f.key));

  const themeColor = normalizeHex(input.themeColor);
  if (!themeColor) return { ok: false, error: "Choose a theme colour." };
  if (!allowedHexes.has(themeColor)) return { ok: false, error: "That theme colour isn't available." };
  if (!meetsContrast(themeColor)) {
    return { ok: false, error: "That theme colour doesn't have enough contrast for readable text." };
  }
  if (!input.fontKey) return { ok: false, error: "Choose a display font." };
  if (!allowedFontKeys.has(input.fontKey)) return { ok: false, error: "That font isn't available." };
  if (!(LOCALES as readonly string[]).includes(input.defaultLocale)) {
    return { ok: false, error: "Choose a valid default language." };
  }

  const data: Record<string, unknown> = {
    themeColor,
    fontKey: input.fontKey,
    defaultLocale: input.defaultLocale,
  };
  if (input.logoKey !== undefined) data.logoKey = input.logoKey;

  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).orgBranding.findFirst();
    if (existing) {
      await tenant(orgId).orgBranding.updateMany({ data });
    } else {
      await tenant(orgId).orgBranding.create({ data });
    }
    await writeAuditLog(
      { actorUserId, action: "branding.update", resourceType: "org_branding", resourceId: orgId, orgId },
      db,
    );
  });
  return { ok: true };
}
