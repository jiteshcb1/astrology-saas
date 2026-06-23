"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { type PaymentFormState, saveGatewayCore, saveUpiCore, testConnectionCore } from "@/lib/payments";
import { putObject } from "@/lib/storage";

const MAX_QR_BYTES = 2 * 1024 * 1024; // 2 MB

export async function saveUpiAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };

  // Optional QR image — through the storage client (stub or real); persist the object KEY only.
  let qrImageKey: string | undefined;
  const file = formData.get("qr");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "QR must be an image file." };
    if (file.size > MAX_QR_BYTES) return { error: "QR image must be 2 MB or smaller." };
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const key = `payments/${orgId}/qr-${Date.now()}.${ext}`;
    const put = await putObject({ key, body: new Uint8Array(await file.arrayBuffer()), contentType: file.type });
    if (!put.ok) return { error: "Could not upload the QR image. Please try again." };
    qrImageKey = put.key;
  }

  const result = await saveUpiCore(
    orgId,
    { upiVpa: String(formData.get("upiVpa") ?? ""), qrImageKey },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/settings/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveGatewayAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };

  const result = await saveGatewayCore(
    orgId,
    { keyId: String(formData.get("keyId") ?? ""), keySecret: String(formData.get("keySecret") ?? "") },
    session.user.id,
  );
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard/settings/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function testConnectionAction(): Promise<PaymentFormState> {
  const { session } = await requireRole("access:dashboard");
  const orgId = session.user.orgId;
  if (!orgId) return { error: "No organization is linked to your account." };
  const tested = await testConnectionCore(orgId); // returns only { ok, message } — never the keys
  return { tested };
}
