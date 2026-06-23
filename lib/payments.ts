import type { PaymentMethod } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import { getSignedUrl } from "@/lib/storage";
import { testConnection as razorpayTestConnection } from "@/lib/razorpay";

// Consultant payment setup (SP-2.4). How the consultant collects money from seekers — the platform
// never touches funds. Tenant-scoped via tenantDb(orgId).paymentMethod.
//
// SECURITY: gateway key_id/key_secret are envelope-encrypted at rest (lib/crypto). The plaintext is
// never persisted, never returned to the client (see toSafeView), and never logged (audit metadata
// records only mode/provider). decryptSecret is called ONLY in testConnectionCore (and the future
// SP-4.3 charge flow) — never at list/render time.

export type PaymentResult = { ok: true } | { ok: false; error: string };
export type PaymentFormState = { error?: string; ok?: boolean; tested?: { ok: boolean; message: string } };

// VPA like name@bank (UPI handle).
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/;
export function isValidVpa(s: string): boolean {
  return VPA_RE.test(s.trim());
}

// ── Pluggable connection boundary (OAuth slots in here later) ─────────────────
export interface PaymentConnection {
  testConnection(creds: { keyId: string; keySecret: string }): Promise<{ ok: boolean; message: string }>;
}
export const razorpayManualKeys: PaymentConnection = {
  testConnection: ({ keyId, keySecret }) => razorpayTestConnection(keyId, keySecret),
};

// ── Data access ───────────────────────────────────────────────────────────────
export async function getPaymentMethod(orgId: string): Promise<PaymentMethod | null> {
  return tenantDb(orgId).paymentMethod.findFirst();
}

// Client-safe view: NO *_enc fields ever leave the server. Only a masked key hint is exposed.
export interface SafePaymentView {
  mode: string | null;
  gatewayProvider: string | null;
  upiVpa: string | null;
  qrUrl: string | null;
  upiConfigured: boolean;
  gatewayConfigured: boolean;
  keyIdLast4: string | null;
}

export async function toSafeView(pm: PaymentMethod | null): Promise<SafePaymentView | null> {
  if (!pm) return null;
  return {
    mode: pm.mode,
    gatewayProvider: pm.gatewayProvider,
    upiVpa: pm.upiVpa,
    qrUrl: pm.qrImageKey ? await getSignedUrl(pm.qrImageKey) : null,
    upiConfigured: Boolean(pm.upiVpa),
    gatewayConfigured: Boolean(pm.gatewayKeySecretEnc),
    keyIdLast4: pm.gatewayKeyIdLast4,
  };
}

// ── Cores ─────────────────────────────────────────────────────────────────────
async function upsert(orgId: string, data: Record<string, unknown>, actorUserId: string, mode: string) {
  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).paymentMethod.findFirst();
    if (existing) {
      await tenant(orgId).paymentMethod.updateMany({ data });
    } else {
      await tenant(orgId).paymentMethod.create({ data: data as never });
    }
    // metadata records THAT config changed + the mode/provider — never key material.
    await writeAuditLog(
      {
        actorUserId,
        action: "payment.update",
        resourceType: "payment_method",
        resourceId: orgId,
        orgId,
        metadata: { mode, ...(data.gatewayProvider ? { provider: data.gatewayProvider } : {}) },
      },
      db,
    );
  });
}

export async function saveUpiCore(
  orgId: string,
  input: { upiVpa: string; qrImageKey?: string },
  actorUserId: string,
): Promise<PaymentResult> {
  if (!isValidVpa(input.upiVpa)) return { ok: false, error: "Enter a valid UPI ID (e.g. name@bank)." };
  const data: Record<string, unknown> = {
    mode: "upi_qr",
    upiVpa: input.upiVpa.trim(),
    isActive: true,
  };
  if (input.qrImageKey) data.qrImageKey = input.qrImageKey;
  await upsert(orgId, data, actorUserId, "upi_qr");
  return { ok: true };
}

export async function saveGatewayCore(
  orgId: string,
  input: { keyId: string; keySecret: string },
  actorUserId: string,
): Promise<PaymentResult> {
  if (!input.keyId.trim() || !input.keySecret.trim()) {
    return { ok: false, error: "Enter both the key id and key secret." };
  }
  if (!isEncryptionConfigured()) {
    return { ok: false, error: "Secure storage isn't configured. Set ENCRYPTION_MASTER_KEY." };
  }
  const keyId = input.keyId.trim();
  const data: Record<string, unknown> = {
    mode: "gateway",
    gatewayProvider: "razorpay",
    connectionType: "manual_keys",
    gatewayKeyIdEnc: encryptSecret(keyId),
    gatewayKeySecretEnc: encryptSecret(input.keySecret.trim()),
    gatewayKeyIdLast4: keyId.slice(-4),
    isActive: true,
  };
  await upsert(orgId, data, actorUserId, "gateway");
  return { ok: true };
}

// The ONLY decryption path. Server-side, on demand. Returns only a verdict — never the keys.
export async function testConnectionCore(orgId: string): Promise<{ ok: boolean; message: string }> {
  if (!isEncryptionConfigured()) return { ok: false, message: "Secure storage isn't configured." };
  const pm = await getPaymentMethod(orgId);
  if (!pm?.gatewayKeyIdEnc || !pm.gatewayKeySecretEnc) {
    return { ok: false, message: "No gateway keys saved yet." };
  }
  const keyId = decryptSecret(pm.gatewayKeyIdEnc);
  const keySecret = decryptSecret(pm.gatewayKeySecretEnc);
  return razorpayManualKeys.testConnection({ keyId, keySecret });
}
