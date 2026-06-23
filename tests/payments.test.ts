import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/db";
import { decryptSecret } from "../lib/crypto";
import {
  getPaymentMethod,
  isValidVpa,
  saveGatewayCore,
  saveUpiCore,
  toSafeView,
} from "../lib/payments";

// ── Pure: validation + masking ────────────────────────────────────────────────
describe("payments pure", () => {
  it("validates UPI VPA", () => {
    expect(isValidVpa("ravi@okhdfc")).toBe(true);
    expect(isValidVpa("ab@cd")).toBe(true);
    expect(isValidVpa("a@bank")).toBe(false); // name too short
    expect(isValidVpa("ravi")).toBe(false);
    expect(isValidVpa("@bank")).toBe(false);
  });

  it("toSafeView never exposes encrypted secrets, only a masked hint", async () => {
    const pm = {
      mode: "gateway",
      gatewayProvider: "razorpay",
      upiVpa: null,
      qrImageKey: null,
      gatewayKeyIdEnc: "v1.aaa.bbb",
      gatewayKeySecretEnc: "v1.ccc.ddd",
      gatewayKeyIdLast4: "1234",
    } as unknown as PaymentMethod;

    const view = await toSafeView(pm);
    expect(view).not.toBeNull();
    const keys = Object.keys(view!);
    expect(keys).not.toContain("gatewayKeySecretEnc");
    expect(keys).not.toContain("gatewayKeyIdEnc");
    expect(view!.gatewayConfigured).toBe(true);
    expect(view!.keyIdLast4).toBe("1234");
    // The serialized safe view must not contain the encrypted blobs.
    expect(JSON.stringify(view)).not.toContain("v1.ccc.ddd");
  });
});

// ── DB-backed cores ───────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "pay-";

d("payment cores (SP-2.4)", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";
  const KEY_ID = "rzp_test_ABCDEF1234";
  const KEY_SECRET = "secret_XyZ_9876_keep_hidden";

  beforeAll(async () => {
    process.env.ENCRYPTION_MASTER_KEY = "test-master-key-please-rotate-in-prod";
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "consultant" } });
    actorId = actor.id;
    const org = await prisma.organization.create({ data: { name: "Pay Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades payment_methods
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("saveGatewayCore encrypts at rest, masks, and never logs the secret", async () => {
    const res = await saveGatewayCore(orgId, { keyId: KEY_ID, keySecret: KEY_SECRET }, actorId);
    expect(res.ok).toBe(true);

    const pm = await getPaymentMethod(orgId);
    // Stored ciphertext is NOT the plaintext, but round-trips back to it.
    expect(pm?.gatewayKeySecretEnc).toBeTruthy();
    expect(pm?.gatewayKeySecretEnc).not.toBe(KEY_SECRET);
    expect(pm?.gatewayKeyIdEnc).not.toBe(KEY_ID);
    expect(decryptSecret(pm!.gatewayKeySecretEnc!)).toBe(KEY_SECRET);
    expect(decryptSecret(pm!.gatewayKeyIdEnc!)).toBe(KEY_ID);
    expect(pm?.gatewayKeyIdLast4).toBe("1234");

    // Audit records THAT config changed — never the key material.
    const logs = await prisma.auditLog.findMany({ where: { actorUserId: actorId, action: "payment.update" } });
    expect(logs.length).toBeGreaterThan(0);
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(KEY_SECRET);
    expect(dump).not.toContain(KEY_ID);

    // Safe view exposes no encrypted material.
    const view = await toSafeView(pm);
    expect(JSON.stringify(view)).not.toContain(KEY_SECRET);
    expect(view?.gatewayConfigured).toBe(true);
    expect(view?.keyIdLast4).toBe("1234");
  });

  it("saveUpiCore persists the VPA", async () => {
    const res = await saveUpiCore(orgId, { upiVpa: "ravi@okhdfc" }, actorId);
    expect(res.ok).toBe(true);
    const pm = await getPaymentMethod(orgId);
    expect(pm?.upiVpa).toBe("ravi@okhdfc");
    expect(pm?.mode).toBe("upi_qr");
    // Switching mode must not wipe the encrypted gateway keys (kept for switch-back).
    expect(pm?.gatewayKeySecretEnc).toBeTruthy();
  });

  it("rejects an invalid VPA", async () => {
    expect((await saveUpiCore(orgId, { upiVpa: "nope" }, actorId)).ok).toBe(false);
  });
});
