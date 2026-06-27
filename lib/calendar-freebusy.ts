import { env, isDev } from "@/lib/env";
import { eachDateISO, zonedClockToUtc } from "@/lib/timezone";
import { getCalendarIntegration, getValidToken } from "@/lib/calendar";
import { freeBusy, type BusyInterval } from "@/lib/google-oauth";

// Track I T-1.2 — fetch + cache a member's Google Calendar busy intervals, used by the scheduling engine to
// subtract external events from bookable slots. EVERY external failure degrades to [] (never throws), so slot
// computation always proceeds with platform-only availability.
//
// Cache: in-memory Map with a 15-min TTL, keyed (orgMemberId, dateISO). Chosen over Cloudflare Workers KV because
// KV needs a wrangler binding that's absent in `npm run dev` and vitest; the Map needs zero infra and works in
// dev/test. Limitation: on Workers each isolate has its own Map (best-effort, not shared across all requests) — a
// KV-backed store is the production upgrade behind this same module's surface.

const TTL_MS = 15 * 60_000;
type CacheEntry = { intervals: BusyInterval[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const keyOf = (orgMemberId: string, dateISO: string) => `${orgMemberId}:${dateISO}`;

async function captureError(e: unknown, ctx: Record<string, unknown>): Promise<void> {
  if (isDev) console.error("[calendar-freebusy]", ctx, e);
  if (env.SENTRY_DSN) {
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e, { extra: ctx });
    } catch {
      /* never let error reporting break slot computation */
    }
  }
}

// Busy intervals for [fromISO, toISO] (date labels in `tz`). Returns [] for not-connected / token-refresh-failure /
// API failure — the graceful-degradation invariant.
export async function getBusyIntervals(
  orgId: string,
  orgMemberId: string,
  fromISO: string,
  toISO: string,
  tz: string,
  now: Date = new Date(),
): Promise<BusyInterval[]> {
  const nowMs = now.getTime();
  const cached: BusyInterval[] = [];
  const misses: string[] = [];
  for (const dateISO of eachDateISO(fromISO, toISO)) {
    const e = cache.get(keyOf(orgMemberId, dateISO));
    if (e && e.expiresAt > nowMs) cached.push(...e.intervals);
    else misses.push(dateISO);
  }
  // Fast path: every day already cached → no DB read, no token decrypt.
  if (misses.length === 0) return cached;

  const ci = await getCalendarIntegration(orgId, orgMemberId);
  if (!ci || ci.status !== "active") return cached; // no calendar connected → skip (unchanged behavior)

  const tok = await getValidToken(orgId, orgMemberId); // refreshes an expired token; marks status=error on failure
  if (!tok.ok) return cached; // refresh failed / not configured → degrade

  const calendarId = ci.calendarId ?? "primary";
  const fetched: BusyInterval[] = [];
  for (const dateISO of misses) {
    fetched.push(...(await getBusyForDay(orgMemberId, dateISO, tz, tok.accessToken, calendarId, now)));
  }
  return [...cached, ...fetched];
}

async function getBusyForDay(orgMemberId: string, dateISO: string, tz: string, accessToken: string, calendarId: string, now: Date): Promise<BusyInterval[]> {
  const key = keyOf(orgMemberId, dateISO);
  const e = cache.get(key);
  if (e && e.expiresAt > now.getTime()) return e.intervals;

  const timeMin = zonedClockToUtc(dateISO, "00:00", tz);
  const timeMax = new Date(timeMin.getTime() + 86_400_000); // +24h covers the local day (exact for fixed-offset IST)
  const intervals = await freeBusy(accessToken, calendarId, timeMin.toISOString(), timeMax.toISOString());
  if (intervals === null) {
    await captureError(new Error("freeBusy request failed"), { orgMemberId, dateISO });
    return []; // do NOT cache a failure — retry on the next load
  }
  cache.set(key, { intervals, expiresAt: now.getTime() + TTL_MS });
  return intervals;
}

// Drop a member's cached days — called when a booking is created/cancelled (T-1.3 will create/delete the matching
// Google event, so the external free/busy changes).
export function invalidateMemberBusyCache(orgMemberId: string): void {
  const prefix = `${orgMemberId}:`;
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

// Test-only: clear the whole cache between cases.
export function __resetBusyCache(): void {
  cache.clear();
}
