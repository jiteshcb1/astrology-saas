"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { PaymentStep, type PaidOutcome } from "@/components/public/PaymentStep";
import { resolveBrand } from "@/lib/branding";
import { validateIntake, validateSeeker } from "@/lib/booking-validate";
import type { HeldBookingView, ConfirmResult } from "@/lib/booking";
import type { PaymentContext, CreateOrderCoreResult, ConfirmPayResult } from "@/lib/payment";

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function googleCalUrl(data: HeldBookingView): string {
  const text = encodeURIComponent(`${data.package.title} with ${data.consultant.displayName}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${icsStamp(data.startISO)}/${icsStamp(data.endISO)}`;
}
function icsHref(data: HeldBookingView): string {
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `DTSTART:${icsStamp(data.startISO)}`, `DTEND:${icsStamp(data.endISO)}`, `SUMMARY:${data.package.title} with ${data.consultant.displayName}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

type Mode = "form" | "pay" | "awaiting" | "success" | "expired";

function modeForStatus(status: string, hasExpiry: boolean): Mode {
  if (status === "confirmed") return "success";
  if (status === "pending_verification") return "awaiting";
  if (status === "pending_payment") return "pay";
  if (status === "expired" || status === "cancelled" || status === "payment_failed" || !hasExpiry) return "expired";
  return "form";
}

export function BookingFlow({
  data,
  confirm,
  rehold,
  paymentContext,
  createGatewayOrder,
  confirmGatewayPayment,
  submitUpiProof,
}: {
  data: HeldBookingView;
  confirm: (details: { name: string; email: string; phone: string }, answers: Record<string, string>) => Promise<ConfirmResult>;
  rehold: () => Promise<{ ok: boolean; bookingId?: string; reason?: string }>;
  paymentContext: PaymentContext | null;
  createGatewayOrder: () => Promise<CreateOrderCoreResult>;
  confirmGatewayPayment: (proof: { orderId: string; paymentId: string; signature: string }) => Promise<ConfirmPayResult>;
  submitUpiProof: (formData: FormData) => Promise<{ ok: boolean; reason?: string; error?: string }>;
}) {
  const router = useRouter();
  const { primary: accent, onPrimary: onAccent } = resolveBrand(data.consultant.themeColor); // PRIMARY brand color
  const { timezone: tz } = data;

  // secsLeft reads the clock — only call it inside effects/handlers (never during render: purity rule).
  function secsLeft(): number {
    if (!data.holdExpiresAtISO) return 0;
    return Math.max(0, Math.round((new Date(data.holdExpiresAtISO).getTime() - Date.now()) / 1000));
  }
  const [mode, setMode] = useState<Mode>(modeForStatus(data.status, Boolean(data.holdExpiresAtISO)));
  const [name, setName] = useState(data.seeker.name);
  const [email, setEmail] = useState(data.seeker.email);
  const [phone, setPhone] = useState(data.seeker.phone || "+91 ");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [photoError, setPhotoError] = useState(false);
  const [shared, setShared] = useState(false);
  const seekerEmail = email || data.seeker.email; // live value typed this session (page doesn't reload)

  useEffect(() => {
    if (mode !== "form" && mode !== "pay") return; // hold is live through details + payment
    const tick = () => {
      const s = secsLeft();
      setRemaining(s);
      if (s <= 0) setMode("expired");
    };
    tick(); // set the real remaining straight away (client-only, in effect)
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: "" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const details = { name, email, phone };
    const local = { ...validateSeeker(details), ...validateIntake(data.questions, answers) };
    const filtered = Object.fromEntries(Object.entries(local).filter(([, v]) => v));
    if (Object.keys(filtered).length > 0) {
      setErrors(filtered);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await confirm(details, answers);
    setSubmitting(false);
    if (res.ok) return setMode("pay");
    if (res.reason === "validation") return setErrors(res.errors);
    if (res.reason === "expired") return setMode("expired");
    setFormError("Something went wrong — your slot is still held, please try again.");
  }

  async function onRehold() {
    setSubmitting(true);
    setFormError(null);
    const res = await rehold();
    setSubmitting(false);
    if (res.ok && res.bookingId) {
      router.push(`/${data.slug}/book/${res.bookingId}`);
      router.refresh();
    } else {
      setFormError(res.reason === "slot_taken" ? "That time was just taken — please pick another." : "Couldn't re-hold this slot. Please pick another time.");
    }
  }

  const initial = (data.consultant.displayName.trim()[0] ?? "A").toUpperCase();

  function consultantPhoto(size: string, textSize: string) {
    return data.consultant.logoUrl && !photoError ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={data.consultant.logoUrl} alt={data.consultant.displayName} onError={() => setPhotoError(true)} className={`${size} rounded-full object-cover`} />
    ) : (
      <span className={`grid ${size} place-items-center rounded-full font-display ${textSize}`} style={{ backgroundColor: accent, color: onAccent }}>{initial}</span>
    );
  }

  async function shareBooking() {
    const text = `Booked: ${data.package.title} with ${data.consultant.displayName} on ${fmtDate(data.startISO, tz)} at ${fmtTime(data.startISO, tz)} (${tz}).`;
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const summary = (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-[0_10px_30px_rgba(20,18,43,0.06)]">
      <div className="flex items-center gap-3 px-5 py-4">
        {consultantPhoto("h-10 w-10", "text-lg")}
        <div className="min-w-0">
          <span className="block font-display text-base leading-tight text-ink">{data.consultant.displayName}</span>
          <span className="block truncate text-xs text-muted">{data.package.title}</span>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4">
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Duration</dt><dd className="text-ink">{data.package.durationLabel}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Date</dt><dd className="text-right font-medium text-ink">{fmtDate(data.startISO, tz)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Time</dt><dd className="text-right font-medium text-ink">{fmtTime(data.startISO, tz)} <span className="font-normal text-muted">({tz})</span></dd></div>
        </dl>
        {/* Order summary */}
        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted">1 × {data.package.title}</span><span className="text-ink">{data.package.priceLabel}</span></div>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-sm font-medium text-ink">Total</span>
          <span className="font-display text-2xl text-ink">{data.package.priceLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-line bg-sand-2/30 px-5 py-2.5 text-xs text-muted">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
        Payments are 100% secure &amp; encrypted
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand">
      <header className="px-4 py-6" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto max-w-4xl">
          <a href={`/${data.slug}`} style={{ borderColor: `${onAccent}55` }} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm opacity-90 transition hover:opacity-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back
          </a>
          <h1 className="mt-3 font-display text-2xl">
            {mode === "success" ? "Booking confirmed" : mode === "awaiting" ? "Almost there" : mode === "expired" ? "Hold expired" : mode === "pay" ? "Complete payment" : "Complete your booking"}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start">
        <aside className="lg:order-2 lg:sticky lg:top-6">{summary}</aside>

        <main className="lg:order-1">
          {mode === "form" && (
            <>
              {/* Hold countdown */}
              <div className="mb-5 flex items-center gap-3 rounded-card border border-marigold/30 bg-marigold/10 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marigold/20 text-lg">⏳</span>
                <div className="min-w-0">
                  {remaining > 0 && <div className="font-display text-2xl tabular-nums leading-none text-ink">{mm}:{ss}</div>}
                  <p className="mt-0.5 text-sm text-muted">Your slot is held — complete your booking below.</p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-5 rounded-card border border-line bg-white p-5 sm:p-6">
                <h2 className="font-display text-lg text-ink">Your details</h2>
                <Field label="Full name" error={errors.name}>
                  <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: "" })); }} autoComplete="name" className={inputCls(errors.name)} placeholder="Your name" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((x) => ({ ...x, email: "" })); }} type="email" inputMode="email" autoComplete="email" className={inputCls(errors.email)} placeholder="you@example.com" />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((x) => ({ ...x, phone: "" })); }} type="tel" inputMode="tel" autoComplete="tel" className={inputCls(errors.phone)} placeholder="+91 98765 43210" />
                </Field>

                {data.questions.filter((q) => q.requirement !== "hidden").length > 0 && (
                  <div className="space-y-5 border-t border-line pt-5">
                    <h2 className="font-display text-lg text-ink">A few questions</h2>
                    {data.questions.filter((q) => q.requirement !== "hidden").map((q) => (
                      <Field key={q.id} label={q.label + (q.requirement === "required" ? " *" : "")} error={errors[q.id]}>
                        {q.fieldType === "long_text" ? (
                          <textarea rows={3} value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} className={inputCls(errors[q.id])} />
                        ) : q.fieldType === "select" ? (
                          <select value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} className={inputCls(errors[q.id])}>
                            <option value="">Select…</option>
                            {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : q.fieldType === "date" ? (
                          <DatePicker value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
                        ) : (
                          <input
                            value={answers[q.id] ?? ""}
                            onChange={(e) => setAnswer(q.id, e.target.value)}
                            type={q.fieldType === "email" ? "email" : q.fieldType === "phone" ? "tel" : "text"}
                            className={inputCls(errors[q.id])}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                )}

                {formError && <p className="rounded-control bg-terra/10 px-3 py-2 text-sm text-terra">{formError}</p>}

                <div className="border-t border-line pt-5">
                  <Button type="submit" disabled={submitting} className="w-full" style={{ backgroundColor: accent, color: onAccent }}>
                    {submitting ? "Confirming…" : "Confirm booking"}
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted">You&apos;ll complete payment next to confirm your spot.</p>
                </div>
              </form>
            </>
          )}

          {mode === "pay" && (
            <>
              <div className="mb-5 flex items-center gap-3 rounded-card border border-marigold/30 bg-marigold/10 px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marigold/20 text-lg">⏳</span>
                <div className="min-w-0">
                  {remaining > 0 && <div className="font-display text-2xl tabular-nums leading-none text-ink">{mm}:{ss}</div>}
                  <p className="mt-0.5 text-sm text-muted">Your slot is held — complete payment to confirm.</p>
                </div>
              </div>
              {paymentContext ? (
                <PaymentStep
                  data={data}
                  context={paymentContext}
                  accent={accent}
                  onAccent={onAccent}
                  createGatewayOrder={createGatewayOrder}
                  confirmGatewayPayment={confirmGatewayPayment}
                  submitUpiProof={submitUpiProof}
                  onPaid={(outcome: PaidOutcome) => setMode(outcome === "confirmed" ? "success" : "awaiting")}
                  onExpired={() => setMode("expired")}
                />
              ) : (
                <p className="rounded-card border border-line bg-white p-6 text-center text-sm text-muted">Payment isn&apos;t available right now. Please try again shortly.</p>
              )}
            </>
          )}

          {mode === "awaiting" && (
            <div className="rounded-card border border-line bg-white p-6 text-center sm:p-9">
              {/* Celestial success motif */}
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full" style={{ backgroundColor: `${accent}1a`, boxShadow: `0 0 30px ${accent}40` }}>
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 6l3.5 7 7.7 1.1-5.6 5.4 1.3 7.6L24 30.9 17.1 34.5l1.3-7.6-5.6-5.4 7.7-1.1z" fill={`${accent}22`} />
                  <path d="M18 24l4 4 8-9" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-ink">Payment submitted — your spot is reserved ✨</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                {data.consultant.displayName} will verify shortly. Your slot remains held during verification.
              </p>

              {/* Booking summary — primary left border */}
              <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-card border border-line bg-sand-2/30 px-5 py-4 text-left" style={{ borderLeftColor: accent, borderLeftWidth: 4 }}>
                {consultantPhoto("h-11 w-11", "text-base")}
                <div className="min-w-0">
                  <p className="font-medium text-ink">{data.package.title}</p>
                  <p className="font-display text-lg text-ink">{fmtDate(data.startISO, tz)} · {fmtTime(data.startISO, tz)}</p>
                  <p className="text-xs text-muted">with {data.consultant.displayName}</p>
                </div>
              </div>

              {/* Timeline */}
              <ol className="mx-auto mt-7 max-w-sm space-y-0 text-left">
                {[
                  { icon: "🔍", title: "Payment verification", body: `${data.consultant.displayName} reviews your screenshot, usually within a few hours.` },
                  { icon: "📧", title: "Confirmation email", body: `Call link sent to ${seekerEmail || "your email"}.` },
                  { icon: "📅", title: "Join at your slot", body: `${fmtDate(data.startISO, tz)} · ${fmtTime(data.startISO, tz)} — add to calendar below.` },
                ].map((s, i, arr) => (
                  <li key={s.title} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" />}
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ backgroundColor: accent, color: onAccent }}>{i + 1}</span>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-ink">{s.icon} {s.title}</p>
                      <p className="text-xs text-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {/* Actions */}
              <div className="mt-7 space-y-2">
                <a href={googleCalUrl(data)} target="_blank" rel="noreferrer" className="block rounded-control px-4 py-3 text-sm font-semibold" style={{ backgroundColor: accent, color: onAccent }}>Add to Calendar</a>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a href={`/${data.slug}`} className="flex-1 rounded-control border border-line px-4 py-2.5 text-sm text-ink transition hover:border-marigold">Back to {data.consultant.displayName}&apos;s page</a>
                  <button type="button" onClick={shareBooking} className="flex-1 rounded-control border border-line px-4 py-2.5 text-sm text-ink transition hover:border-marigold">{shared ? "Copied ✓" : "Share booking"}</button>
                </div>
                <a href={icsHref(data)} download={`${data.package.title}.ics`} className="block text-xs text-muted hover:text-ink">Download .ics</a>
              </div>

              <p className="mt-6 text-xs text-muted">Questions? Contact {data.consultant.displayName}.</p>
            </div>
          )}

          {mode === "success" && (
            <div className="rounded-card border border-line bg-white p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: accent, color: onAccent }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h2 className="font-display text-2xl text-ink">Booking confirmed!</h2>
              <p className="mt-1 text-sm text-muted">A confirmation email is on its way to <strong className="text-ink">{seekerEmail || "your email"}</strong>.</p>
              <div className="mx-auto mt-5 max-w-xs space-y-1.5 rounded-card bg-sand-2/40 px-5 py-4 text-sm">
                <p className="font-medium text-ink">{data.package.title} · {data.package.durationLabel}</p>
                <p className="text-ink">{fmtDate(data.startISO, tz)}</p>
                <p className="text-ink">{fmtTime(data.startISO, tz)} <span className="text-muted">({tz})</span></p>
                <p className="text-muted">with {data.consultant.displayName}</p>
                {paymentContext && <p className="text-ink">Paid {paymentContext.priceLabel}</p>}
              </div>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <a href={googleCalUrl(data)} target="_blank" rel="noreferrer" className="rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-marigold">Add to Google Calendar</a>
                <a href={icsHref(data)} download={`${data.package.title}.ics`} className="rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-marigold">Download .ics</a>
              </div>
            </div>
          )}

          {mode === "expired" && (
            <div className="rounded-card border border-line bg-white p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-sand-2 text-muted">⌛</div>
              <h2 className="font-display text-xl text-ink">Your hold expired</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                This slot may now be available again. You can try to hold it once more, or pick another time.
              </p>
              {formError && <p className="mx-auto mt-3 max-w-sm rounded-control bg-terra/10 px-3 py-2 text-sm text-terra">{formError}</p>}
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Button type="button" onClick={onRehold} disabled={submitting} style={{ backgroundColor: accent, color: onAccent }}>
                  {submitting ? "Trying…" : "Re-hold this slot"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push(`/${data.slug}`)}>Pick another time</Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function inputCls(error?: string): string {
  return `w-full rounded-control border bg-white px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-marigold ${error ? "border-terra" : "border-line"}`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-terra">{error}</span>}
    </label>
  );
}
