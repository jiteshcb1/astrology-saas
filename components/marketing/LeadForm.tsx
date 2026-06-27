"use client";

import { useActionState } from "react";
import { submitLeadAction, type LeadFormState } from "@/app/(marketing)/lead-actions";

// SP-6.3 — public lead form (landing section + /get-started). Server action only (no client fetch). Inline
// success on submit — no redirect. Option arrays are inlined (client-safe; the server core re-validates).
const PRACTICE_TYPES = ["Vedic", "Tarot", "Numerology", "Palmistry", "Vastu", "Other"];
const HEARD_FROM = ["Instagram", "WhatsApp", "Astrotalk", "JustDial", "Friend", "Other"];

const fieldCls = "w-full rounded-control border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-marigold";
const labelCls = "mb-1.5 block text-sm font-medium text-ink";

export function LeadForm() {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(submitLeadAction, {});

  if (state.ok) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center shadow-[0_18px_40px_rgba(20,18,43,0.08)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green/15 text-green">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h3 className="mt-4 font-display text-2xl text-ink">We got it!</h3>
        <p className="mx-auto mt-2 max-w-sm text-muted">Expect a WhatsApp message from us within 24 hours — we&apos;ll set up a quick 15-minute demo where you&apos;ll see your astrology page live.</p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-card border border-line bg-white p-6 shadow-[0_18px_40px_rgba(20,18,43,0.08)] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="lead-name" className={labelCls}>Full name <span className="text-terra">*</span></label>
          <input id="lead-name" name="name" required autoComplete="name" placeholder="e.g. Pandit Ravi Sharma" className={fieldCls} />
        </div>
        <div>
          <label htmlFor="lead-email" className={labelCls}>Email <span className="text-terra">*</span></label>
          <input id="lead-email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={fieldCls} />
        </div>
        <div>
          <label htmlFor="lead-whatsapp" className={labelCls}>WhatsApp number <span className="text-terra">*</span></label>
          <input id="lead-whatsapp" name="whatsapp" required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" className={fieldCls} />
        </div>
        <div>
          <label htmlFor="lead-practice" className={labelCls}>Type of practice</label>
          <select id="lead-practice" name="practiceType" defaultValue="" className={fieldCls}>
            <option value="">Select…</option>
            {PRACTICE_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="lead-heard" className={labelCls}>How did you hear about us?</label>
          <select id="lead-heard" name="heardFrom" defaultValue="" className={fieldCls}>
            <option value="">Select…</option>
            {HEARD_FROM.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="lead-message" className={labelCls}>Message</label>
          <textarea id="lead-message" name="message" rows={3} placeholder="Tell us about your practice…" className={fieldCls} />
        </div>
      </div>

      {state.error && <p className="mt-4 text-sm text-terra">{state.error}</p>}

      <button type="submit" disabled={pending} className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-marigold px-6 py-3 text-sm font-semibold text-night transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
        {pending ? "Sending…" : "Get early access"}
      </button>
      <p className="mt-3 text-xs text-muted">We&apos;ll reach out on WhatsApp within 24 hours. No spam, ever.</p>
    </form>
  );
}
