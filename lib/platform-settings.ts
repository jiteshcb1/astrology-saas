import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// Platform-level operational toggles (super-admin gated). NOT tenant-scoped → bare prisma.platformSetting.
// Email kill-switch: one switch PER notification type + a MASTER "pause all". A send is allowed only when
// BOTH the master and that type are enabled. Each defaults ON when its row is absent (kill-switch semantics).

export type EmailType =
  | "otp"
  | "booking_confirmed"
  | "proof_received"
  | "booking_declined"
  | "new_booking"
  | "consultant_welcome"
  | "org_invite"
  | "meet_link_failed"
  | "lead_notification"
  | "lead_ack";

export type EmailGroup = "Authentication" | "Seeker" | "Consultant" | "Team" | "Platform";

export const EMAIL_TYPES: { key: EmailType; label: string; description: string; group: EmailGroup }[] = [
  { key: "otp", label: "Sign-in codes (OTP)", description: "One-time codes for email sign-in. Pausing blocks email-only login (Google still works).", group: "Authentication" },
  { key: "booking_confirmed", label: "Booking confirmed", description: "Sent to the seeker when their booking is confirmed.", group: "Seeker" },
  { key: "proof_received", label: "Payment proof received", description: "Sent to the seeker when their UPI proof is received.", group: "Seeker" },
  { key: "booking_declined", label: "Booking declined", description: "Sent to the seeker when a booking is declined.", group: "Seeker" },
  { key: "new_booking", label: "New booking alert", description: "Sent to the consultant when a new booking comes in.", group: "Consultant" },
  { key: "consultant_welcome", label: "Welcome email", description: "Sent to a consultant when their consultancy is created.", group: "Consultant" },
  { key: "meet_link_failed", label: "Meet link needs sending", description: "Sent to the consultant when a Google Meet link couldn't be auto-generated for a confirmed booking.", group: "Consultant" },
  { key: "org_invite", label: "Team invitation", description: "Sent to a person invited to join a team.", group: "Team" },
  { key: "lead_notification", label: "New lead alert", description: "Sent to the super-admin when a marketing lead is captured.", group: "Platform" },
  { key: "lead_ack", label: "Lead acknowledgement", description: "Sent to a marketing lead confirming we received their inquiry.", group: "Platform" },
];

export const MASTER_KEY = "all";
const EMAIL_KEYS = new Set<string>([MASTER_KEY, ...EMAIL_TYPES.map((t) => t.key)]);
const rowKey = (key: string) => `emails.${key}`;

// HARD global email kill-switch, controlled ONLY in code (not the super-admin UI). While true, NO email of any
// type is sent and the Email Notification Management toggles are greyed out + write-locked. Flip to false to
// resume (then the per-type/master DB switches apply again). Re-activated 2026-06-27 per request — emails ON
// (governed by the per-type/master switches in /superadmin/settings, which default enabled).
export const EMAILS_GLOBALLY_PAUSED = false;

export type PlatformSettingResult = { ok: true } | { ok: false; error: string };

function readEnabled(value: unknown): boolean {
  // Absent row → default ON; only an explicit { enabled: false } pauses it.
  if (value && typeof value === "object" && "enabled" in value) {
    return (value as { enabled?: unknown }).enabled !== false;
  }
  return true;
}

// A type's email may send only if the master switch AND that type are both enabled —
// and never while the hard code-level pause is engaged.
export async function isEmailTypeEnabled(type: EmailType): Promise<boolean> {
  if (EMAILS_GLOBALLY_PAUSED) return false;
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: [rowKey(MASTER_KEY), rowKey(type)] } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return readEnabled(byKey.get(rowKey(MASTER_KEY))) && readEnabled(byKey.get(rowKey(type)));
}

export interface EmailToggleView {
  enabled: boolean;
  updatedAtISO: string | null;
}
export interface EmailSettingsView {
  master: EmailToggleView;
  types: Array<{ key: EmailType; label: string; description: string; group: EmailGroup; enabled: boolean; updatedAtISO: string | null }>;
  /** When true, the hard code-level pause is on: every type is effectively off + the UI is write-locked. */
  globallyPaused: boolean;
}

export async function getEmailSettingsView(): Promise<EmailSettingsView> {
  const rows = await prisma.platformSetting.findMany({ where: { key: { startsWith: "emails." } } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const toView = (key: string): EmailToggleView => {
    const row = byKey.get(rowKey(key));
    return { enabled: readEnabled(row?.value), updatedAtISO: row ? row.updatedAt.toISOString() : null };
  };
  return {
    master: toView(MASTER_KEY),
    types: EMAIL_TYPES.map((t) => ({ ...t, ...toView(t.key) })),
    globallyPaused: EMAILS_GLOBALLY_PAUSED,
  };
}

export async function setEmailSetting(key: string, enabled: boolean, actorUserId: string): Promise<PlatformSettingResult> {
  if (EMAILS_GLOBALLY_PAUSED) return { ok: false, error: "Email sending is globally paused in code and can't be changed here." };
  if (!EMAIL_KEYS.has(key)) return { ok: false, error: "Unknown email setting." };
  const fullKey = rowKey(key);
  await prisma.platformSetting.upsert({
    where: { key: fullKey },
    update: { value: { enabled } },
    create: { key: fullKey, value: { enabled } },
  });
  await writeAuditLog({ actorUserId, action: "platform_setting.update", resourceType: "platform_setting", resourceId: fullKey, metadata: { key, enabled } });
  return { ok: true };
}
