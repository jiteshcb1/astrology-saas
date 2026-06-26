import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { otpEmail } from "@/lib/emails";
import { isDev } from "@/lib/env";

// Email one-time-code (OTP) backend for the `email-otp` Auth.js provider.
// Codes are persisted in `verification_codes` (see prisma/schema.prisma) HASHED — the plaintext
// is never stored. Sending is via lib/email (a console stub when RESEND_API_KEY is empty).
//
// Security posture (SP-1.2):
// - crypto-strong 6-digit codes, SHA-256 at rest, 10-minute expiry, single-use.
// - exactly ONE live code per email: issuing a new code invalidates any prior unconsumed ones.
// - issuance rate limits (per-email cooldown + per-email/hour + per-IP/hour), DB-counted.
// - verify attempt cap per code (lock on exceed).
// - enumeration-safe: no user-existence lookup here; the user row is upserted only on a
//   successful verify (see lib/auth.ts). Callers should surface a single generic response.

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const RESEND_COOLDOWN_MS = 30 * 1000; // min gap between codes for one email
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 10;
export const MAX_VERIFY_ATTEMPTS = 5;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  // Uniformly random in [0, 10^6) — crypto-strong, no modulo bias.
  return randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}


export interface SendOtpResult {
  ok: boolean;
  /** Internal reason when not ok (callers surface a single generic message). */
  reason?: "cooldown" | "rate_limited";
  cooldownSeconds?: number;
  /** Returned in dev only so flows can be tested without a real inbox. */
  devCode?: string;
}

/**
 * Generate, persist (hashed), and send an OTP for `email`, enforcing issuance rate limits.
 * Performs no user-existence check — safe against account enumeration.
 */
export async function sendOtp(
  email: string,
  opts: { ip?: string } = {},
): Promise<SendOtpResult> {
  const normalized = normalizeEmail(email);
  const ip = opts.ip;
  const now = Date.now();

  // Per-email resend cooldown.
  const recent = await prisma.verificationCode.findFirst({
    where: { email: normalized, createdAt: { gt: new Date(now - RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const cooldownSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS - (now - recent.createdAt.getTime())) / 1000,
    );
    return { ok: false, reason: "cooldown", cooldownSeconds: Math.max(cooldownSeconds, 1) };
  }

  // Per-email hourly cap.
  const emailCount = await prisma.verificationCode.count({
    where: { email: normalized, createdAt: { gt: new Date(now - RATE_WINDOW_MS) } },
  });
  if (emailCount >= MAX_CODES_PER_EMAIL_PER_HOUR) {
    return { ok: false, reason: "rate_limited" };
  }

  // Per-IP hourly cap (when an IP is known).
  if (ip) {
    const ipCount = await prisma.verificationCode.count({
      where: { requestIp: ip, createdAt: { gt: new Date(now - RATE_WINDOW_MS) } },
    });
    if (ipCount >= MAX_CODES_PER_IP_PER_HOUR) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  // Invalidate any still-valid prior codes for this email so there is EXACTLY ONE live code at a time.
  // Without this, a user who requested more than once ends up with several valid codes but verify only
  // honors the newest — typing an older email's code fails repeatedly ("invalid code again and again").
  await prisma.verificationCode.updateMany({
    where: { email: normalized, consumed: false },
    data: { consumed: true },
  });

  const code = generateCode();
  await prisma.verificationCode.create({
    data: {
      email: normalized,
      codeHash: hashCode(code),
      expiresAt: new Date(now + CODE_TTL_MS),
      requestIp: ip ?? null,
    },
  });

  await sendEmail({ to: normalized, type: "otp", ...otpEmail(code) });

  if (isDev) {
    console.log(`[otp:dev] code for ${normalized}: ${code}`);
    return { ok: true, devCode: code };
  }
  return { ok: true };
}

/**
 * Verify an OTP. Returns true only on an exact, unexpired, unconsumed, under-attempt-cap match.
 * Records every attempt; consumes the code on success or once the attempt cap is exceeded.
 * Failure is uniform across wrong/expired/consumed/locked/no-code — no enumeration signal.
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const normalized = normalizeEmail(email);

  const record = await prisma.verificationCode.findFirst({
    where: { email: normalized, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;

  const attempt = record.attemptCount + 1;

  // Too many attempts — lock this code and reject (even a correct code).
  if (attempt > MAX_VERIFY_ATTEMPTS) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attemptCount: attempt, consumed: true },
    });
    return false;
  }

  const match = hashCode(code) === record.codeHash;
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { attemptCount: attempt, consumed: match },
  });
  return match;
}
