"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { HeldBookingView } from "@/lib/booking";
import type { PaymentContext, CreateOrderCoreResult, ConfirmPayResult } from "@/lib/payment";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

type RazorpayHandler = (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
interface RazorpayOptions {
  key: string; order_id: string; amount: number; currency: string; name: string; description?: string;
  handler: RazorpayHandler; modal?: { ondismiss?: () => void }; prefill?: { name?: string; email?: string; contact?: string }; theme?: { color?: string };
}
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void } }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export type PaidOutcome = "confirmed" | "verification";

export function PaymentStep({
  data,
  context,
  accent,
  onAccent,
  createGatewayOrder,
  confirmGatewayPayment,
  submitUpiProof,
  onPaid,
  onExpired,
}: {
  data: HeldBookingView;
  context: PaymentContext;
  accent: string;
  onAccent: string;
  createGatewayOrder: () => Promise<CreateOrderCoreResult>;
  confirmGatewayPayment: (proof: { orderId: string; paymentId: string; signature: string }) => Promise<ConfirmPayResult>;
  submitUpiProof: (formData: FormData) => Promise<{ ok: boolean; reason?: string; error?: string }>;
  onPaid: (outcome: PaidOutcome) => void;
  onExpired: () => void;
}) {
  const pv = context.paymentView;
  const hasUpi = Boolean(pv?.upiConfigured);
  const hasGateway = Boolean(pv?.gatewayConfigured);
  const rupees = (context.amountPaise / 100).toFixed(2);

  const [method, setMethod] = useState<"upi" | "gateway" | null>(hasUpi && hasGateway ? null : hasUpi ? "upi" : hasGateway ? "gateway" : null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // UPI proof state
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [utr, setUtr] = useState("");

  if (!hasUpi && !hasGateway) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center">
        <h2 className="font-display text-lg text-ink">Payment not available yet</h2>
        <p className="mt-2 text-sm text-muted">This consultant hasn&apos;t finished setting up payments. Please contact them to complete your booking.</p>
      </div>
    );
  }

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); setPreview(null); return; }
    if (!PROOF_TYPES.includes(f.type)) return setError("Upload an image (PNG/JPG/WebP) or PDF.");
    if (f.size > MAX_PROOF_BYTES) return setError("File is too large — max 5 MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function copyVpa() {
    if (!pv?.upiVpa) return;
    try { await navigator.clipboard.writeText(pv.upiVpa); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  async function onUpiSubmit() {
    if (!file) return setError("Please attach your payment screenshot.");
    setBusy(true); setError(null); setStatus("Submitting…");
    const fd = new FormData();
    fd.set("proof", file);
    if (utr.trim()) fd.set("utr", utr.trim());
    const res = await submitUpiProof(fd);
    setBusy(false); setStatus(null);
    if (res.ok) return onPaid("verification");
    if (res.reason === "expired") return onExpired();
    setError(res.error || "Couldn't submit your proof. Please try again.");
  }

  async function onGatewayPay() {
    setBusy(true); setError(null); setStatus("Setting up your payment…");
    const order = await createGatewayOrder();
    if (!order.ok) { setBusy(false); setStatus(null); return setError(order.error); }
    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay) { setBusy(false); setStatus(null); return setError("Couldn't load the payment window. Please try again."); }

    setStatus(null);
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.consultantName,
      description: data.package.title,
      prefill: { name: data.seeker.name, email: data.seeker.email, contact: data.seeker.phone },
      theme: { color: accent },
      modal: { ondismiss: () => { setBusy(false); setStatus(null); } },
      handler: (r) => {
        setStatus("Verifying payment…");
        confirmGatewayPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature })
          .then((res: ConfirmPayResult) => {
            setBusy(false); setStatus(null);
            if (res.ok) return onPaid("confirmed");
            if (res.reason === "expired") return onExpired();
            setError("We couldn't verify the payment. If you were charged, contact the consultant.");
          });
      },
    });
    rzp.open();
  }

  return (
    <div className="space-y-5">
      {/* Method selection (only when both are available) */}
      {hasUpi && hasGateway && !method && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between rounded-card border border-line bg-white px-5 py-3.5">
            <span className="text-sm text-muted">Total</span>
            <span className="font-display text-2xl text-ink">{context.priceLabel}</span>
          </div>

          <button type="button" onClick={() => setMethod("upi")} style={{ borderLeftColor: accent }} className="flex min-h-[80px] w-full items-center gap-4 rounded-card border border-line border-l-4 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(20,18,43,0.08)]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-sand-2/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 20v.01M17 20h.01M20 14h.01" strokeLinecap="round" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">Pay via UPI</span>
              <span className="block text-xs text-muted">Scan the QR or pay the UPI ID, then upload your screenshot.</span>
              <span className="mt-1.5 flex flex-wrap gap-1">{["PhonePe", "GPay", "Paytm", "BHIM"].map((n) => <span key={n} className="rounded bg-sand-2 px-1.5 py-0.5 text-[10px] text-muted">{n}</span>)}</span>
            </span>
            <Chevron />
          </button>

          <button type="button" onClick={() => setMethod("gateway")} style={{ borderLeftColor: accent }} className="flex min-h-[80px] w-full items-center gap-4 rounded-card border border-line border-l-4 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(20,18,43,0.08)]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-sand-2/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">Pay with Card or Netbanking</span>
              <span className="block text-xs text-muted">Secure instant confirmation via Razorpay.</span>
              <span className="mt-1.5 flex flex-wrap gap-1">{["VISA", "Mastercard", "RuPay"].map((n) => <span key={n} className="rounded bg-sand-2 px-1.5 py-0.5 text-[10px] text-muted">{n}</span>)}</span>
            </span>
            <span className="flex items-center gap-1.5"><Lock /><Chevron /></span>
          </button>

          <p className="px-1 text-xs text-muted">🔒 {context.priceLabel} goes directly to {context.consultantName}.</p>
          <p className="px-1 text-xs text-muted">🔒 Payments are 100% secure &amp; encrypted.</p>
          <WhatHappensNext consultantName={context.consultantName} />
        </div>
      )}

      {/* Gateway */}
      {method === "gateway" && (
        <div className="rounded-card border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Pay {context.priceLabel}</h2>
            {hasUpi && <button type="button" onClick={() => setMethod(null)} className="text-xs text-muted hover:text-ink">Change method</button>}
          </div>
          <p className="mt-1 text-sm text-muted">You&apos;ll pay securely on {order_name(context)}&apos;s payment window. Your slot stays held.</p>
          <p className="mt-1.5 text-xs text-muted">🔒 {context.priceLabel} goes directly to {context.consultantName}.</p>
          {error && <p className="mt-3 rounded-control bg-terra/10 px-3 py-2 text-sm text-terra">{error}</p>}
          <Button type="button" onClick={onGatewayPay} disabled={busy} className="mt-4 w-full" style={{ backgroundColor: accent, color: onAccent }}>
            {busy ? (status ?? "Processing…") : `Pay ${context.priceLabel}`}
          </Button>
          {busy && status && <p className="mt-2 text-center text-xs text-muted">Please don&apos;t close this page.</p>}
        </div>
      )}

      {/* UPI */}
      {method === "upi" && !showUpload && (
        <div className="rounded-card border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Pay {context.priceLabel} via UPI</h2>
            {hasGateway && <button type="button" onClick={() => setMethod(null)} className="text-xs text-muted hover:text-ink">Change method</button>}
          </div>
          {pv?.qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pv.qrUrl} alt="UPI QR code" className="mx-auto mt-4 h-56 w-56 rounded-card border border-line object-contain bg-white p-2" />
          )}
          {pv?.upiVpa && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
              <span className="truncate font-mono text-sm text-ink">{pv.upiVpa}</span>
              <button type="button" onClick={copyVpa} className="shrink-0 rounded-control border border-line px-3 py-1 text-xs text-ink transition hover:border-marigold">{copied ? "Copied ✓" : "Copy"}</button>
            </div>
          )}
          {pv?.upiVpa && (
            <a href={`upi://pay?pa=${encodeURIComponent(pv.upiVpa)}&pn=${encodeURIComponent(context.consultantName)}&am=${rupees}&cu=INR`} className="mt-2 block rounded-control border border-line px-3 py-2 text-center text-sm text-ink transition hover:border-marigold">
              Open in a UPI app
            </a>
          )}
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Scan the QR or copy the UPI ID.</li>
            <li>Pay exactly <strong className="text-ink">{context.priceLabel}</strong>.</li>
            <li>Come back and upload your payment screenshot.</li>
          </ol>
          <Button type="button" onClick={() => setShowUpload(true)} className="mt-4 w-full" style={{ backgroundColor: accent, color: onAccent }}>
            I&apos;ve paid — upload proof
          </Button>
        </div>
      )}

      {/* UPI proof upload */}
      {method === "upi" && showUpload && (
        <div className="rounded-card border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Upload payment proof</h2>
            <button type="button" onClick={() => setShowUpload(false)} className="text-xs text-muted hover:text-ink">Back</button>
          </div>
          <label className="mt-4 block cursor-pointer rounded-card border border-dashed border-line p-6 text-center transition hover:border-marigold">
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Proof preview" className="mx-auto max-h-48 rounded-control object-contain" />
            ) : file ? (
              <p className="text-sm text-ink">{file.name}</p>
            ) : (
              <p className="text-sm text-muted">Tap to upload a screenshot or PDF<br /><span className="text-xs">Max 5 MB</span></p>
            )}
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm text-muted">UTR / reference (optional)</span>
            <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UPI reference" className="w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-marigold" />
          </label>
          {error && <p className="mt-3 rounded-control bg-terra/10 px-3 py-2 text-sm text-terra">{error}</p>}
          <Button type="button" onClick={onUpiSubmit} disabled={busy || !file} className="mt-4 w-full" style={{ backgroundColor: accent, color: onAccent }}>
            {busy ? "Submitting…" : "Submit for verification"}
          </Button>
        </div>
      )}
    </div>
  );
}

function order_name(ctx: PaymentContext): string {
  return ctx.consultantName || "the consultant";
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}
function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-green"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
  );
}
function WhatHappensNext({ consultantName }: { consultantName: string }) {
  const rows = [
    { icon: "📧", text: "A confirmation email once your payment is verified." },
    { icon: "📅", text: "Add the session to your calendar." },
    { icon: "💬", text: `${consultantName} will reach out before the session.` },
  ];
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <p className="mb-3 text-sm font-medium text-ink">What happens next</p>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-3 text-sm text-muted">
            <span className="shrink-0 text-base">{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
