import { timingSafeEqual } from "node:crypto";
import type { CalendarIntegration } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { refreshAccessToken, revokeToken } from "@/lib/google-oauth";

// Track I T-1.1 — Google Calendar connection cores (DB + crypto), mirroring lib/payments.ts. OAuth tokens are
// envelope-encrypted at rest; the ONLY decrypt paths are getValidToken (for an immediate API call) and
// revokeCalendarCore (to revoke at Google). toSafeView never exposes the *_enc fields. All access tenant-scoped.

const REFRESH_SKEW_MS = 5 * 60_000; // refresh when <5 min of life remains

export interface SafeCalendarView {
  provider: string;
  connected: boolean;
  googleEmail: string | null;
  calendarId: string | null;
  connectedAtISO: string | null;
  status: string;
  lastError: string | null;
}

// Strips both encrypted token fields — tokens never leave the server.
export function toSafeView(ci: CalendarIntegration | null): SafeCalendarView | null {
  if (!ci) return null;
  return {
    provider: ci.provider,
    connected: ci.status === "active" && Boolean(ci.accessTokenEnc),
    googleEmail: ci.googleEmail,
    calendarId: ci.calendarId,
    connectedAtISO: ci.connectedAt.toISOString(),
    status: ci.status,
    lastError: ci.lastError,
  };
}

export function getCalendarIntegration(orgId: string, orgMemberId: string): Promise<CalendarIntegration | null> {
  return tenantDb(orgId).calendarIntegration.findFirst({ where: { orgMemberId } }) as Promise<CalendarIntegration | null>;
}

// True when the org owner (the `consultant` member) has an active calendar connection — drives the setup checklist.
export async function isOwnerCalendarConnected(orgId: string): Promise<boolean> {
  const owner = await tenantDb(orgId).orgMember.findFirst({ where: { role: "consultant", status: "active" } });
  if (!owner) return false;
  const ci = await getCalendarIntegration(orgId, owner.id);
  return Boolean(ci && ci.status === "active");
}

// CSRF: constant-time compare of the state cookie set at /start vs the state Google echoes on /callback.
export function statesMatch(cookieState: string | undefined, queryState: string | null | undefined): boolean {
  if (!cookieState || !queryState) return false;
  const a = Buffer.from(cookieState);
  const b = Buffer.from(queryState);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface SaveConnectionInput {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  calendarId?: string | null;
  googleEmail?: string | null;
}

export async function saveCalendarConnectionCore(
  orgId: string,
  orgMemberId: string,
  input: SaveConnectionInput,
  actorUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isEncryptionConfigured()) return { ok: false, error: "Secure storage isn't configured. Set ENCRYPTION_MASTER_KEY." };
  const data: Record<string, unknown> = {
    provider: "google",
    accessTokenEnc: encryptSecret(input.accessToken),
    expiresAt: input.expiresAt,
    calendarId: input.calendarId ?? "primary",
    googleEmail: input.googleEmail ?? null,
    connectedAt: new Date(),
    status: "active",
    lastError: null,
  };
  if (input.refreshToken) data.refreshTokenEnc = encryptSecret(input.refreshToken);

  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).calendarIntegration.findFirst({ where: { orgMemberId } });
    if (existing) {
      await tenant(orgId).calendarIntegration.updateMany({ where: { orgMemberId }, data });
    } else {
      await tenant(orgId).calendarIntegration.create({ data: { ...data, orgMemberId } as never });
    }
    // Audit records only provider + whether a refresh token was granted — NEVER token material.
    await writeAuditLog(
      { actorUserId, action: "calendar.connect", resourceType: "calendar_integration", resourceId: orgMemberId, orgId, metadata: { provider: "google", refresh: Boolean(input.refreshToken) } },
      db,
    );
  });
  return { ok: true };
}

export type ValidTokenResult = { ok: true; accessToken: string } | { ok: false; reason: "not_connected" | "refresh_failed" | "not_configured" };

// The ONLY decrypt path for an API call. Refreshes within 5 min of expiry, persisting the new (encrypted) token;
// on refresh failure marks status="error" so the UI can prompt a reconnect. Plaintext is returned for immediate
// use only — never stored or logged.
export async function getValidToken(orgId: string, orgMemberId: string): Promise<ValidTokenResult> {
  if (!isEncryptionConfigured()) return { ok: false, reason: "not_configured" };
  const ci = await getCalendarIntegration(orgId, orgMemberId);
  if (!ci || ci.status !== "active" || !ci.accessTokenEnc) return { ok: false, reason: "not_connected" };

  if (ci.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return { ok: true, accessToken: decryptSecret(ci.accessTokenEnc) };
  }

  if (!ci.refreshTokenEnc) {
    await markError(orgId, orgMemberId, "No refresh token — please reconnect Google Calendar.");
    return { ok: false, reason: "refresh_failed" };
  }
  const refreshed = await refreshAccessToken(decryptSecret(ci.refreshTokenEnc));
  if (!refreshed.ok) {
    await markError(orgId, orgMemberId, refreshed.invalidGrant ? "Google access was revoked — please reconnect." : "Couldn't refresh Google access.");
    return { ok: false, reason: "refresh_failed" };
  }
  const expiresAt = new Date(Date.now() + refreshed.tokens.expiresInSec * 1000);
  await tenantDb(orgId).calendarIntegration.updateMany({
    where: { orgMemberId },
    data: { accessTokenEnc: encryptSecret(refreshed.tokens.accessToken), expiresAt, status: "active", lastError: null },
  });
  return { ok: true, accessToken: refreshed.tokens.accessToken };
}

async function markError(orgId: string, orgMemberId: string, message: string): Promise<void> {
  await tenantDb(orgId).calendarIntegration.updateMany({ where: { orgMemberId }, data: { status: "error", lastError: message } });
}

// Revoke at Google (best-effort, decrypt only here), then delete the row locally either way. Existing bookings'
// meetLink is intentionally left intact — already-confirmed meetings keep working.
export async function revokeCalendarCore(orgId: string, orgMemberId: string, actorUserId: string): Promise<{ ok: boolean }> {
  const ci = await getCalendarIntegration(orgId, orgMemberId);
  if (!ci) return { ok: true };
  if (isEncryptionConfigured() && ci.accessTokenEnc) {
    try {
      await revokeToken(decryptSecret(ci.accessTokenEnc));
    } catch {
      /* best-effort — proceed to local delete */
    }
  }
  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).calendarIntegration.deleteMany({ where: { orgMemberId } });
    await writeAuditLog({ actorUserId, action: "calendar.disconnect", resourceType: "calendar_integration", resourceId: orgMemberId, orgId, metadata: { provider: ci.provider } }, db);
  });
  return { ok: true };
}
