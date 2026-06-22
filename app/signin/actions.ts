"use server";

import { headers } from "next/headers";
import { sendOtp } from "@/lib/otp";
import { isDev } from "@/lib/env";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface RequestOtpResult {
  ok: boolean;
  message: string;
  /** Dev-only convenience so the flow is testable without a real inbox. */
  devCode?: string;
}

// Thin wrapper over sendOtp: extracts the client IP and returns a SINGLE generic response
// regardless of whether the email is registered or rate-limited (enumeration-safe).
// A format error is returned distinctly — it reveals nothing about account existence.
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
  const message = "If that email can receive codes, a 6-digit code is on its way.";
  return isDev && result.devCode ? { ok: true, message, devCode: result.devCode } : { ok: true, message };
}
