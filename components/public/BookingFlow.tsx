"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { PaymentStep, type PaidOutcome } from "@/components/public/PaymentStep";
import { readableTextOn } from "@/lib/branding";
import { validateIntake, validateSeeker } from "@/lib/booking-validate";
import type { HeldBookingView, ConfirmResult } from "@/lib/booking";
import type { PaymentContext, CreateOrderCoreResult, ConfirmPayResult } from "@/lib/payment";

const DEFAULT_THEME = "#e8a33d";

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
  const accent = data.consultant.themeColor || DEFAULT_THEME;
  const onAccent = readableTextOn(accent);
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
  const [summaryOpen, setSummaryOpen] = useState(false);

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

  const summary = (
    <div className="rounded-card border border-line bg-white shadow-[0_10px_30px_rgba(20,18,43,0.06)]">
      <button
        type="button"
        onClick={() => setSummaryOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left lg:cursor-default"
      >
        <span className="flex items-center gap-3">
          {data.consultant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.consultant.logoUrl} alt={data.consultant.displayName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full font-display text-lg" style={{ backgroundColor: accent, color: onAccent }}>{initial}</span>
          )}
          <span className="min-w-0">
            <span className="block font-display text-base leading-tight text-ink">{data.consultant.displayName}</span>
            <span className="block truncate text-xs text-muted">{data.package.title}</span>
          </span>
        </span>
        <span className="text-muted lg:hidden">{summaryOpen ? "▲" : "▼"}</span>
      </button>
      <div className={`${summaryOpen ? "block" : "hidden"} border-t border-line px-5 py-4 lg:block`}>
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted">Session</dt><dd className="text-right text-ink">{data.package.title}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Duration</dt><dd className="text-ink">{data.package.durationLabel}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Date</dt><dd className="text-right text-ink">{fmtDate(data.startISO, tz)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Time</dt><dd className="text-right text-ink">{fmtTime(data.startISO, tz)} <span className="text-muted">({tz})</span></dd></div>
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-sm text-muted">Price</span>
          <span className="font-display text-2xl text-ink">{data.package.priceLabel}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand">
      <header className="px-4 py-6" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto max-w-4xl">
          <a href={`/${data.slug}`} className="text-sm opacity-90 hover:opacity-100">← {data.consultant.displayName}</a>
          <h1 className="mt-1 font-display text-2xl">
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
              <div className="mb-5 flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sand-2 text-marigold">⏳</span>
                <p className="text-sm text-ink">
                  {remaining > 0 ? (
                    <>Your slot is held for <strong className="tabular-nums">{mm}:{ss}</strong> — complete your booking below.</>
                  ) : (
                    <>Your slot is held — complete your booking below.</>
                  )}
                </p>
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
              <div className="mb-5 flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-sand-2 text-marigold">⏳</span>
                <p className="text-sm text-ink">
                  {remaining > 0 ? (
                    <>Your slot is held for <strong className="tabular-nums">{mm}:{ss}</strong> — complete payment to confirm.</>
                  ) : (
                    <>Your slot is held — complete payment to confirm.</>
                  )}
                </p>
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
            <div className="rounded-card border border-line bg-white p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-sand-2 text-marigold">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" /></svg>
              </div>
              <h2 className="font-display text-2xl text-ink">Proof received</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                {data.consultant.displayName} will verify your payment and confirm your booking. You&apos;ll get a confirmation email at <strong className="text-ink">{data.seeker.email}</strong>.
              </p>
              <div className="mx-auto mt-5 max-w-xs space-y-1.5 rounded-card bg-sand-2/40 px-5 py-4 text-sm">
                <p className="font-medium text-ink">{data.package.title} · {data.package.durationLabel}</p>
                <p className="text-ink">{fmtDate(data.startISO, tz)} · {fmtTime(data.startISO, tz)}</p>
                <p className="text-muted">with {data.consultant.displayName}</p>
              </div>
              <ol className="mx-auto mt-5 max-w-xs list-decimal space-y-1 pl-5 text-left text-sm text-muted">
                <li>The consultant reviews your payment proof.</li>
                <li>You get a confirmation email with the call link.</li>
                <li>Join at your booked time.</li>
              </ol>
            </div>
          )}

          {mode === "success" && (
            <div className="rounded-card border border-line bg-white p-6 text-center sm:p-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: accent, color: onAccent }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h2 className="font-display text-2xl text-ink">Booking confirmed!</h2>
              <p className="mt-1 text-sm text-muted">A confirmation email is on its way to <strong className="text-ink">{data.seeker.email}</strong>.</p>
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
