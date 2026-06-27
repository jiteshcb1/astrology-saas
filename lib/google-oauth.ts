import { env } from "@/lib/env";

// Track I T-1.1 — low-level Google OAuth + Calendar REST helpers (no SDK; plain fetch, same style as
// lib/razorpay.ts). Never throws; returns result objects. Stub-safe: guarded on isGoogleOAuthConfigured().
// Uses the SAME OAuth client as sign-in (GOOGLE_CLIENT_ID/SECRET) but a DISTINCT redirect URI + Calendar scopes.
// Tokens pass through here as plaintext for IMMEDIATE use only — callers (lib/calendar.ts) encrypt at rest;
// nothing here logs token material.

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];
export const CALENDAR_CALLBACK_PATH = "/api/calendar/callback";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const PRIMARY_CAL_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary";

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function calendarRedirectUri(): string {
  return `${env.AUTH_URL.replace(/\/$/, "")}${CALENDAR_CALLBACK_PATH}`;
}

// access_type=offline + prompt=consent → Google always returns a refresh_token (needed for unattended refresh).
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: calendarRedirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number;
}
export type TokenResult = { ok: true; tokens: TokenSet } | { ok: false; error: string; invalidGrant?: boolean };

async function tokenRequest(body: URLSearchParams): Promise<TokenResult> {
  if (!isGoogleOAuthConfigured()) return { ok: false, error: "Google OAuth is not configured." };
  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !data.access_token) {
      return { ok: false, error: data.error || `token request failed (${res.status})`, invalidGrant: data.error === "invalid_grant" };
    }
    return { ok: true, tokens: { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSec: data.expires_in ?? 3600 } };
  } catch {
    return { ok: false, error: "Could not reach Google." };
  }
}

export function exchangeCode(code: string): Promise<TokenResult> {
  return tokenRequest(
    new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: calendarRedirectUri(),
      grant_type: "authorization_code",
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  return tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  );
}

// Best-effort: revoke at Google. Network failure is non-fatal — the caller deletes the row locally regardless.
export async function revokeToken(token: string): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  try {
    const res = await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// T-1.2 — free/busy for a single calendar over [timeMin, timeMax] (RFC3339 UTC). Returns busy intervals, or
// null on ANY failure (non-ok, calendar-level error, network) so the caller can degrade to platform-only slots.
export interface BusyInterval {
  start: Date;
  end: Date;
}
export async function freeBusy(accessToken: string, calendarId: string, timeMinISO: string, timeMaxISO: string): Promise<BusyInterval[] | null> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: calendarId }] }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
    const cal = data.calendars?.[calendarId];
    if (!cal || (cal.errors && cal.errors.length > 0)) return null;
    return (cal.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch {
    return null;
  }
}

// T-1.3 — create a Calendar event with conferenceData (auto-generates a Meet link). conferenceDataVersion=1 is
// REQUIRED for the Meet link to be created. Returns the event id + the video entryPoint URI, or null on failure.
export interface CreatedEvent {
  id: string;
  meetLink: string | null;
}
export async function createCalendarEvent(accessToken: string, calendarId: string, body: Record<string, unknown>): Promise<CreatedEvent | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } };
    if (!data.id) return null;
    const video = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
    return { id: data.id, meetLink: video?.uri ?? null };
  } catch {
    return null;
  }
}

// T-1.3 — delete an event (best-effort). Already-gone (404/410) counts as success so cleanup is idempotent.
export async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { ok: res.ok || res.status === 404 || res.status === 410 };
  } catch {
    return { ok: false };
  }
}

// The primary calendar's id IS the account email — used for the connected-state label + calendarId.
export interface PrimaryCalendar {
  id: string;
  summary?: string;
}
export async function getPrimaryCalendar(accessToken: string): Promise<PrimaryCalendar | null> {
  try {
    const res = await fetch(PRIMARY_CAL_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; summary?: string };
    return data.id ? { id: data.id, summary: data.summary } : null;
  } catch {
    return null;
  }
}
