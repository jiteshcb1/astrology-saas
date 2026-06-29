import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// Global promo campaign — drives the marketing top banner + display-only discounted prices on /pricing.
// Stored as a single PlatformSetting row (key/value), like the email kill-switches. Platform-level → bare
// prisma.platformSetting is fine. Pure helpers below are client-safe.

export const PROMO_KEY = "promo.banner";

export interface Promo {
  enabled: boolean;
  name: string;
  tagline: string;
  startsAt: string | null; // YYYY-MM-DD (date-only window)
  endsAt: string | null;
}

const EMPTY_PROMO: Promo = { enabled: false, name: "", tagline: "", startsAt: null, endsAt: null };

// Current date in IST as YYYY-MM-DD. Windows are date-only and compared lexically → DST-proof.
export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

export function promoActive(promo: Promo, todayISO: string): boolean {
  if (!promo.enabled || !promo.name.trim() || !promo.tagline.trim()) return false;
  if (promo.startsAt && todayISO < promo.startsAt) return false;
  if (promo.endsAt && todayISO > promo.endsAt) return false;
  return true;
}

export interface PlanDiscount {
  showDiscount: boolean;
  actualPaise: number;
  discountedPaise: number;
  isFree: boolean;
}

// Resolve how a plan's price should display. showDiscount only when the campaign is active AND the plan has a
// discounted price set (null = no discount, 0 = Free, >0 = amount).
export function planDiscount(plan: Pick<SubscriptionPlan, "price" | "discountedPrice">, active: boolean): PlanDiscount {
  const has = plan.discountedPrice !== null && plan.discountedPrice !== undefined;
  const show = active && has;
  const discountedPaise = has ? (plan.discountedPrice as number) : plan.price;
  return { showDiscount: show, actualPaise: plan.price, discountedPaise, isFree: show && discountedPaise === 0 };
}

function coerce(value: unknown): Promo {
  if (!value || typeof value !== "object") return EMPTY_PROMO;
  const v = value as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    name: typeof v.name === "string" ? v.name : "",
    tagline: typeof v.tagline === "string" ? v.tagline : "",
    startsAt: typeof v.startsAt === "string" && v.startsAt ? v.startsAt : null,
    endsAt: typeof v.endsAt === "string" && v.endsAt ? v.endsAt : null,
  };
}

export async function getPromo(): Promise<Promo> {
  const row = await prisma.platformSetting.findUnique({ where: { key: PROMO_KEY } });
  return coerce(row?.value);
}

export type PromoResult = { ok: true } | { ok: false; error: string };

export async function savePromoCore(input: Promo, actorUserId: string): Promise<PromoResult> {
  const name = input.name.trim();
  const tagline = input.tagline.trim();
  const startsAt = input.startsAt || null;
  const endsAt = input.endsAt || null;
  if (input.enabled && !name) return { ok: false, error: "The banner needs a name when enabled." };
  if (input.enabled && !tagline) return { ok: false, error: "The banner needs a tagline when enabled." };
  if (startsAt && endsAt && endsAt < startsAt) return { ok: false, error: "End date must be on or after the start date." };

  const value = { enabled: input.enabled, name, tagline, startsAt, endsAt };
  await prisma.platformSetting.upsert({ where: { key: PROMO_KEY }, update: { value }, create: { key: PROMO_KEY, value } });
  await writeAuditLog({ actorUserId, action: "promo.update", resourceType: "platform_setting", resourceId: PROMO_KEY, metadata: { enabled: input.enabled, name } });
  return { ok: true };
}
