import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  MAX_CODES_PER_EMAIL_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  sendOtp,
  verifyOtp,
} from "../lib/otp";

// DB-backed; skips cleanly when no DATABASE_URL is configured.
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const PREFIX = "otp-test-";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const email = (label: string) => `${PREFIX}${label}-${Date.now()}@example.com`;
const wrongOf = (code: string) => (code === "000000" ? "111111" : "000000");

d("OTP backend (SP-1.2)", () => {
  afterAll(async () => {
    await prisma.verificationCode.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("stores the code hashed (never plaintext) and verifies the happy path once", async () => {
    const e = email("happy");
    const sent = await sendOtp(e);
    expect(sent.ok).toBe(true);
    const code = sent.devCode!;
    expect(code).toMatch(/^\d{6}$/);

    const row = await prisma.verificationCode.findFirst({
      where: { email: e },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    expect(row!.codeHash).toHaveLength(64);
    expect(row!.codeHash).not.toBe(code); // not stored in plaintext
    expect(row!.codeHash).toBe(sha256(code)); // exactly the SHA-256

    expect(await verifyOtp(e, code)).toBe(true);
    // Reuse rejected (consumed).
    expect(await verifyOtp(e, code)).toBe(false);
  });

  it("issuing a new code invalidates the prior one (exactly one live code)", async () => {
    const e = email("single");
    const first = await sendOtp(e);
    const code1 = first.devCode!;
    const firstRow = await prisma.verificationCode.findFirstOrThrow({ where: { email: e }, orderBy: { createdAt: "desc" } });
    // Age the first code past the resend cooldown so a second issue is permitted.
    await prisma.verificationCode.update({ where: { id: firstRow.id }, data: { createdAt: new Date(Date.now() - 31_000) } });

    const second = await sendOtp(e);
    expect(second.ok).toBe(true);
    const code2 = second.devCode!;

    // The prior code's row is now consumed (invalidated by the new issue)...
    const oldRow = await prisma.verificationCode.findUniqueOrThrow({ where: { id: firstRow.id } });
    expect(oldRow.consumed).toBe(true);
    // ...so an older code fails while the newest still verifies. (Guard the 1-in-10^6 code collision.)
    if (code1 !== code2) expect(await verifyOtp(e, code1)).toBe(false);
    expect(await verifyOtp(e, code2)).toBe(true);
  });

  it("rejects an expired code", async () => {
    const e = email("expired");
    const sent = await sendOtp(e);
    const code = sent.devCode!;
    await prisma.verificationCode.updateMany({
      where: { email: e },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyOtp(e, code)).toBe(false);
  });

  it("locks the code after too many attempts (even a correct code then fails)", async () => {
    const e = email("lockout");
    const sent = await sendOtp(e);
    const code = sent.devCode!;
    const wrong = wrongOf(code);

    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      expect(await verifyOtp(e, wrong)).toBe(false);
    }
    // Cap exceeded → locked; the correct code is now rejected too.
    expect(await verifyOtp(e, code)).toBe(false);
  });

  it("enforces the per-email resend cooldown", async () => {
    const e = email("cooldown");
    expect((await sendOtp(e)).ok).toBe(true);
    const second = await sendOtp(e);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("cooldown");
    expect(second.cooldownSeconds).toBeGreaterThan(0);
  });

  it("enforces the per-email hourly cap", async () => {
    const e = email("hourly");
    // Pre-seed the hourly quota with rows older than the cooldown window but within the hour.
    const old = new Date(Date.now() - 60_000);
    for (let i = 0; i < MAX_CODES_PER_EMAIL_PER_HOUR; i++) {
      await prisma.verificationCode.create({
        data: { email: e, codeHash: sha256(`seed-${i}`), expiresAt: new Date(Date.now() + 600_000), createdAt: old },
      });
    }
    const res = await sendOtp(e);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("rate_limited");
  });

  it("does not leak account existence (same shape for registered vs unregistered)", async () => {
    const registered = email("registered");
    await prisma.user.create({ data: { email: registered, role: "seeker" } });
    const unregistered = email("unregistered");

    const a = await sendOtp(registered);
    const b = await sendOtp(unregistered);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(typeof a.devCode).toBe("string");
    expect(typeof b.devCode).toBe("string");
  });
});
