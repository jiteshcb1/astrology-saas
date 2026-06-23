"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { PaymentFormState, SafePaymentView } from "@/lib/payments";
import { saveGatewayAction, saveUpiAction, testConnectionAction } from "@/app/dashboard/settings/payments/actions";

export function PaymentForm({ current }: { current: SafePaymentView | null }) {
  const [mode, setMode] = useState<"upi_qr" | "gateway">(
    current?.mode === "gateway" ? "gateway" : "upi_qr",
  );

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-display text-lg text-ink">Payment method</h2>
        <p className="mt-0.5 text-sm text-muted">
          Money goes directly to you — Astro Consultancy never holds funds.
        </p>
        <div className="mt-4 inline-flex rounded-control border border-line p-1">
          <button
            type="button"
            onClick={() => setMode("upi_qr")}
            className={`rounded-[7px] px-4 py-1.5 text-sm transition ${mode === "upi_qr" ? "bg-marigold text-night" : "text-muted hover:text-ink"}`}
          >
            UPI QR + manual proof
          </button>
          <button
            type="button"
            onClick={() => setMode("gateway")}
            className={`rounded-[7px] px-4 py-1.5 text-sm transition ${mode === "gateway" ? "bg-marigold text-night" : "text-muted hover:text-ink"}`}
          >
            Connect Razorpay (your keys)
          </button>
        </div>
      </Card>

      {mode === "upi_qr" ? <UpiPanel current={current} /> : <GatewayPanel current={current} />}
    </div>
  );
}

function UpiPanel({ current }: { current: SafePaymentView | null }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(saveUpiAction, {});
  const [qrPreview, setQrPreview] = useState<string | null>(current?.qrUrl ?? null);

  return (
    <Card>
      <form action={action} className="space-y-4">
        <Input
          name="upiVpa"
          label="UPI ID (VPA)"
          defaultValue={current?.upiVpa ?? ""}
          placeholder="yourname@bank"
          required
        />
        <div>
          <span className="mb-1.5 block text-sm text-muted">UPI QR image</span>
          <p className="mb-2 text-xs text-muted">PNG or JPG up to 2 MB. Seekers scan this to pay you.</p>
          <div className="flex items-center gap-4">
            {qrPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrPreview}
                alt="UPI QR"
                className="h-20 w-20 rounded-control border border-line bg-white object-contain"
                onError={() => setQrPreview(null)}
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-control border border-dashed border-line text-xs text-muted">
                No QR
              </div>
            )}
            <input
              type="file"
              name="qr"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setQrPreview(URL.createObjectURL(f));
              }}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border file:border-line file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-marigold"
            />
          </div>
        </div>
        {state.error && <p className="text-sm text-terra">{state.error}</p>}
        {state.ok && <p className="text-sm text-green">Saved. Seekers will pay you via UPI.</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save UPI details"}
        </Button>
      </form>
    </Card>
  );
}

function GatewayPanel({ current }: { current: SafePaymentView | null }) {
  const [state, action, pending] = useActionState<PaymentFormState, FormData>(saveGatewayAction, {});
  const [testState, testAction, testing] = useActionState<PaymentFormState, FormData>(testConnectionAction, {});
  const configured = Boolean(current?.gatewayConfigured);
  const [replacing, setReplacing] = useState(!configured);

  return (
    <Card>
      <p className="mb-4 text-sm text-muted">
        Paste your own Razorpay API keys. Charges are created on <strong>your</strong> account, so funds
        settle directly to your bank. Your secret is encrypted at rest and never shown again.
      </p>

      {configured && !replacing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-control border border-line bg-sand-2/30 px-4 py-3">
            <div className="text-sm text-ink">
              <span className="font-medium">Configured</span> · key{" "}
              <span className="font-mono">•••• {current?.keyIdLast4}</span>
            </div>
            <Button type="button" variant="ghost" onClick={() => setReplacing(true)}>
              Replace keys
            </Button>
          </div>
          <form action={testAction}>
            <Button type="submit" variant="ghost" disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
          </form>
          {testState.tested && (
            <p className={`text-sm ${testState.tested.ok ? "text-green" : "text-terra"}`}>
              {testState.tested.message}
            </p>
          )}
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <Input name="keyId" label="Key ID" placeholder="rzp_live_…" autoComplete="off" required />
          <Input
            name="keySecret"
            label="Key secret"
            type="password"
            placeholder="Never shown again after saving"
            autoComplete="off"
            required
          />
          {state.error && <p className="text-sm text-terra">{state.error}</p>}
          {state.ok && <p className="text-sm text-green">Keys saved securely.</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save keys"}
            </Button>
            {configured && (
              <Button type="button" variant="ghost" onClick={() => setReplacing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
