import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// Platform-level operational toggles (super-admin gated). NOT tenant-scoped → bare prisma.platformSetting.
// Email kill-switch: two independent categories, each defaulting ON when the row is absent.

export type EmailCategory = "otp" | "transactional";
const KEY: Record<EmailCategory, string> = { otp: "emails.otp", transactional: "emails.transactional" };

export type PlatformSettingResult = { ok: true } | { ok: false; error: string };

function readEnabled(value: unknown): boolean {
  // Absent row → default ON; only an explicit { enabled: false } pauses the category.
  if (value && typeof value === "object" && "enabled" in value) {
    return (value as { enabled?: unknown }).enabled !== false;
  }
  return true;
}

export async function isEmailCategoryEnabled(category: EmailCategory): Promise<boolean> {
  const row = await prisma.platformSetting.findUnique({ where: { key: KEY[category] } });
  return readEnabled(row?.value);
}

export interface EmailSettingsView {
  otp: { enabled: boolean; updatedAtISO: string | null };
  transactional: { enabled: boolean; updatedAtISO: string | null };
}

export async function getEmailSettings(): Promise<EmailSettingsView> {
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: [KEY.otp, KEY.transactional] } } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const view = (category: EmailCategory) => {
    const row = byKey.get(KEY[category]);
    return { enabled: readEnabled(row?.value), updatedAtISO: row ? row.updatedAt.toISOString() : null };
  };
  return { otp: view("otp"), transactional: view("transactional") };
}

export async function setEmailCategoryEnabled(category: string, enabled: boolean, actorUserId: string): Promise<PlatformSettingResult> {
  if (category !== "otp" && category !== "transactional") return { ok: false, error: "Unknown email category." };
  const key = KEY[category as EmailCategory];
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value: { enabled } },
    create: { key, value: { enabled } },
  });
  await writeAuditLog({ actorUserId, action: "platform_setting.update", resourceType: "platform_setting", resourceId: key, metadata: { key, enabled } });
  return { ok: true };
}
