import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isDev } from "@/lib/env";

// Email + one-time-code (OTP) flow — STUBBED.
// Codes are persisted in the `verification_codes` table (see prisma/schema.prisma).
// No real email is sent yet: in dev we console.log the code. Replace the TODOs for production.

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_LENGTH = 6;

function generateCode(): string {
  // 6-digit numeric code. TODO: use a crypto-strong generator for production.
  const n = Math.floor(Math.random() * 10 ** CODE_LENGTH);
  return n.toString().padStart(CODE_LENGTH, "0");
}

/**
 * Generate, persist, and "send" an OTP for the given email.
 * Returns the code in dev so flows can be tested without email; never returns it in prod.
 */
export async function sendOtp(email: string): Promise<{ ok: boolean; devCode?: string }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.verificationCode.create({
    data: { email, code, expiresAt },
  });

  // TODO: design the real OTP email template.
  await sendEmail({
    to: email,
    subject: "Your Astro Consultancy verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });

  if (isDev) {
    console.log(`[otp:stub] code for ${email}: ${code}`);
    return { ok: true, devCode: code };
  }

  return { ok: true };
}

/**
 * Verify an OTP for the given email. Marks the code consumed on success.
 * TODO: add rate limiting / attempt counting before production.
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: { email, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  return true;
}
