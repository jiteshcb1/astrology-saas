// Razorpay adapter — Phase 1 needs only a credential check. Verifies BYO keys with a harmless
// server-side REST read (no SDK dependency). Keys are used only for the Basic-auth header here; they
// are never logged and never returned to the caller — only a success/failure verdict leaves this file.
//
// The actual order-create + webhook flow lands in SP-4.3 (the charge loop), behind the same boundary.

export interface RazorpayTestResult {
  ok: boolean;
  message: string;
}

export async function testConnection(keyId: string, keySecret: string): Promise<RazorpayTestResult> {
  if (!keyId.trim() || !keySecret.trim()) return { ok: false, message: "Missing key id or secret." };
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    // A read-only, side-effect-free endpoint: lists recent payments (count=1).
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true, message: "Keys verified." };
    if (res.status === 401) return { ok: false, message: "Razorpay rejected these keys." };
    return { ok: false, message: "Could not verify keys. Please try again." };
  } catch {
    // Network/other failure — fail closed, leak nothing.
    return { ok: false, message: "Could not reach Razorpay. Please try again." };
  }
}
