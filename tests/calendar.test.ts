import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Mock only the network helpers; keep buildAuthUrl/statesMatch real.
vi.mock("@/lib/google-oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/google-oauth")>();
  return { ...actual, refreshAccessToken: vi.fn(), revokeToken: vi.fn() };
});

import { prisma } from "../lib/db";
import { decryptSecret, isEncryptionConfigured } from "../lib/crypto";
import { buildAuthUrl, refreshAccessToken, revokeToken } from "../lib/google-oauth";
import {
  getCalendarIntegration,
  getValidToken,
  revokeCalendarCore,
  saveCalendarConnectionCore,
  statesMatch,
  toSafeView,
} from "../lib/calendar";

// ── Pure (no DB / no network) ──────────────────────────────────────────────────
describe("calendar — pure helpers", () => {
  it("statesMatch is constant-time exact (mismatch/empty → false)", () => {
    expect(statesMatch("abc123", "abc123")).toBe(true);
    expect(statesMatch("abc123", "abc124")).toBe(false);
    expect(statesMatch("abc", "abcd")).toBe(false); // different length
    expect(statesMatch(undefined, "abc")).toBe(false);
    expect(statesMatch("abc", null)).toBe(false);
  });

  it("buildAuthUrl requests both Calendar scopes + offline + consent + the callback redirect", () => {
    const url = buildAuthUrl("state-xyz");
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("response_type=code");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=state-xyz");
    expect(decodeURIComponent(url)).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(decodeURIComponent(url)).toContain("https://www.googleapis.com/auth/calendar.readonly");
    expect(decodeURIComponent(url)).toContain("/api/calendar/callback");
  });
});

// ── DB + crypto cores ──────────────────────────────────────────────────────────
const ready = Boolean(process.env.DATABASE_URL) && isEncryptionConfigured();
const d = ready ? describe : describe.skip;
const PREFIX = "cal-test-";

d("calendar — connection cores", () => {
  const stamp = Date.now();
  let orgId = "";
  let memberId = "";
  let userId = "";
  const future = () => new Date(Date.now() + 60 * 60_000);
  const past = () => new Date(Date.now() - 60_000);

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "Cal", slug: `${PREFIX}${stamp}`, status: "active" } });
    orgId = org.id;
    const user = await prisma.user.create({ data: { email: `${PREFIX}${stamp}@example.com`, role: "consultant" } });
    userId = user.id;
    const member = await prisma.orgMember.create({ data: { organizationId: orgId, userId, role: "consultant", status: "active" } });
    memberId = member.id;
  });

  afterAll(async () => {
    await prisma.calendarIntegration.deleteMany({ where: { organizationId: orgId } });
    await prisma.auditLog.deleteMany({ where: { orgId } });
    await prisma.orgMember.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    (refreshAccessToken as Mock).mockReset();
    (revokeToken as Mock).mockReset();
  });

  it("stores tokens ENCRYPTED (no plaintext), audits without token material, and toSafeView strips *Enc", async () => {
    const r = await saveCalendarConnectionCore(orgId, memberId, { accessToken: "ACCESS_PLAIN", refreshToken: "REFRESH_PLAIN", expiresAt: future(), calendarId: "primary", googleEmail: "user@gmail.com" }, userId);
    expect(r.ok).toBe(true);

    const row = await prisma.calendarIntegration.findFirstOrThrow({ where: { orgMemberId: memberId } });
    expect(row.accessTokenEnc).not.toContain("ACCESS_PLAIN"); // encrypted at rest
    expect(row.refreshTokenEnc).not.toContain("REFRESH_PLAIN");
    expect(decryptSecret(row.accessTokenEnc)).toBe("ACCESS_PLAIN"); // round-trips
    expect(decryptSecret(row.refreshTokenEnc!)).toBe("REFRESH_PLAIN");

    const safe = toSafeView(row) as Record<string, unknown>;
    expect(safe.connected).toBe(true);
    expect(safe.googleEmail).toBe("user@gmail.com");
    expect("accessTokenEnc" in safe).toBe(false);
    expect("refreshTokenEnc" in safe).toBe(false);

    const audit = await prisma.auditLog.findFirst({ where: { orgId, action: "calendar.connect" } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain("ACCESS_PLAIN");
    expect(JSON.stringify(audit)).not.toContain("REFRESH_PLAIN");
  });

  it("getValidToken returns the stored token when unexpired (no refresh call)", async () => {
    await saveCalendarConnectionCore(orgId, memberId, { accessToken: "STILL_GOOD", refreshToken: "RT", expiresAt: future() }, userId);
    const res = await getValidToken(orgId, memberId);
    expect(res).toEqual({ ok: true, accessToken: "STILL_GOOD" });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("getValidToken refreshes an expired token + persists the new (encrypted) token", async () => {
    await saveCalendarConnectionCore(orgId, memberId, { accessToken: "OLD", refreshToken: "RT", expiresAt: past() }, userId);
    (refreshAccessToken as Mock).mockResolvedValueOnce({ ok: true, tokens: { accessToken: "NEW_TOKEN", expiresInSec: 3600 } });

    const res = await getValidToken(orgId, memberId);
    expect(refreshAccessToken).toHaveBeenCalledWith("RT");
    expect(res).toEqual({ ok: true, accessToken: "NEW_TOKEN" });

    const row = await prisma.calendarIntegration.findFirstOrThrow({ where: { orgMemberId: memberId } });
    expect(decryptSecret(row.accessTokenEnc)).toBe("NEW_TOKEN");
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(row.status).toBe("active");
  });

  it("getValidToken marks status=error when the refresh is rejected", async () => {
    await saveCalendarConnectionCore(orgId, memberId, { accessToken: "OLD", refreshToken: "RT", expiresAt: past() }, userId);
    (refreshAccessToken as Mock).mockResolvedValueOnce({ ok: false, error: "invalid_grant", invalidGrant: true });

    const res = await getValidToken(orgId, memberId);
    expect(res).toEqual({ ok: false, reason: "refresh_failed" });
    const row = await prisma.calendarIntegration.findFirstOrThrow({ where: { orgMemberId: memberId } });
    expect(row.status).toBe("error");
    expect(row.lastError).toBeTruthy();
  });

  it("revoke deletes the row + audits (and still deletes if revoke fetch fails)", async () => {
    await saveCalendarConnectionCore(orgId, memberId, { accessToken: "AT", refreshToken: "RT", expiresAt: future() }, userId);
    (revokeToken as Mock).mockRejectedValueOnce(new Error("network")); // even on failure, local delete proceeds

    const r = await revokeCalendarCore(orgId, memberId, userId);
    expect(r.ok).toBe(true);
    expect(await getCalendarIntegration(orgId, memberId)).toBeNull();
    expect(await prisma.auditLog.findFirst({ where: { orgId, action: "calendar.disconnect" } })).not.toBeNull();
  });
});
