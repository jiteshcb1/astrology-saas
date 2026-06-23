import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "../lib/crypto";

// Envelope encryption is pure (no DB) — always runs. We set a master key in-process.
describe("crypto envelope encryption", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY = "test-master-key-please-rotate-in-prod";
  });

  it("reports configured when the master key is set", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("round-trips: decrypt(encrypt(x)) === x", () => {
    const secret = "rzp_test_secret_AbCd1234EfGh";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
    expect(decryptSecret(encryptSecret(""))).toBe(""); // empty edge
    const unicode = "सिक्रेट · 秘密 · 🔐";
    expect(decryptSecret(encryptSecret(unicode))).toBe(unicode);
  });

  it("ciphertext never contains the plaintext", () => {
    const secret = "supersecretvalue";
    expect(encryptSecret(secret)).not.toContain(secret);
  });

  it("is non-deterministic (random DEK + IV per call)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered blob (GCM auth)", () => {
    const blob = encryptSecret("secret");
    const parts = blob.split(".");
    // Flip a byte in the ciphertext segment.
    const ct = Buffer.from(parts[6], "base64");
    ct[0] ^= 0xff;
    parts[6] = ct.toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
    expect(() => decryptSecret("not-a-valid-blob")).toThrow();
  });
});
