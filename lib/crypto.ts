import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Envelope encryption for at-rest secrets (consultant gateway keys, SP-2.4).
// Per call: a random 256-bit DATA KEY (DEK) encrypts the plaintext (AES-256-GCM); the DEK is then
// wrapped by a MASTER KEY (KEK) derived from ENCRYPTION_MASTER_KEY. Plaintext is never stored, and a
// blob can only be opened with the master key. Decryption is server-side, on demand, only at use.
//
// The master key is read from process.env at CALL TIME (not the lib/env snapshot) so rotation/tests
// work without re-import. crypto is only ever *called*, never run at import — the app boots on empty env.
//
// Phase 1: master key lives in a Cloudflare Worker secret. A managed KMS can replace deriveKek() later
// without changing the blob format. Works on Workers via nodejs_compat (full node:crypto).

const VERSION = "v1";
const ALG = "aes-256-gcm";
const IV_LEN = 12; // GCM standard nonce

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_MASTER_KEY);
}

function deriveKek(): Buffer {
  const master = process.env.ENCRYPTION_MASTER_KEY;
  if (!master) throw new Error("ENCRYPTION_MASTER_KEY is not set");
  // Normalize any sufficiently-strong master string to exactly 32 bytes.
  return createHash("sha256").update(master).digest();
}

function gcmEncrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; tag: Buffer; ct: Buffer } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

function gcmDecrypt(key: Buffer, iv: Buffer, tag: Buffer, ct: Buffer): Buffer {
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// Returns a self-describing blob: v1.<kekIv>.<kekTag>.<wrappedDek>.<dataIv>.<dataTag>.<ciphertext>
export function encryptSecret(plaintext: string): string {
  const kek = deriveKek();
  const dek = randomBytes(32);
  const data = gcmEncrypt(dek, Buffer.from(plaintext, "utf8"));
  const wrap = gcmEncrypt(kek, dek);
  const parts = [wrap.iv, wrap.tag, wrap.ct, data.iv, data.tag, data.ct].map((b) =>
    b.toString("base64"),
  );
  return [VERSION, ...parts].join(".");
}

export function decryptSecret(blob: string): string {
  const parts = blob.split(".");
  if (parts[0] !== VERSION || parts.length !== 7) throw new Error("Malformed ciphertext");
  const [, kekIv, kekTag, wrappedDek, dataIv, dataTag, ct] = parts;
  const kek = deriveKek();
  const b = (s: string) => Buffer.from(s, "base64");
  const dek = gcmDecrypt(kek, b(kekIv), b(kekTag), b(wrappedDek));
  return gcmDecrypt(dek, b(dataIv), b(dataTag), b(ct)).toString("utf8");
}
