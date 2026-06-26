"use server";

import { headers } from "next/headers";
import { sendOtp } from "@/lib/otp";
import { isDev } from "@/lib/env";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface RequestOtpResult {
  ok: boolean;
  message: string;
  /** Seconds the caller must wait before retrying (cooldown). Drives the resend countdown. */
  retryAfter?: number;
  /** Dev-only convenience so the flow is testable without a real inbox. */
  devCode?: string;
}

// Thin wrapper over sendOtp: extracts the client IP and returns an enumeration-safe response.
// Success is generic (reveals nothing about account existence). Cooldown / rate-limit ARE surfaced —
// they depend only on how often THIS email string was used, not on whether the account exists, so
// telling the user to wait leaks nothing yet stops them entering stale codes that were never sent.
export async function requestOtp(emailRaw: string): Promise<RequestOtpResult> {
  const email = (emailRaw ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("cf-connecting-ip") ??
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined;

  const result = await sendOtp(email, { ip });

  if (!result.ok) {
    if (result.reason === "cooldown") {
      const secs = result.cooldownSeconds ?? 30;
      return { ok: false, message: `Please wait ${secs}s before requesting another code.`, retryAfter: secs };
    }
    // rate_limited — too many codes for this email in the last hour. No code was sent.
    return { ok: false, message: "Too many code requests for this email. Please try again in about an hour." };
  }

  const message = "If that email can receive codes, a 6-digit code is on its way.";
  return isDev && result.devCode ? { ok: true, message, devCode: result.devCode } : { ok: true, message };
}
