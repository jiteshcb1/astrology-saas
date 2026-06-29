"use client";

import { useActionState, useEffect, useState } from "react";
import { submitLeadAction, type LeadFormState } from "@/app/(marketing)/lead-actions";

const fieldCls = "w-full rounded-control border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-marigold";
const labelCls = "mb-1.5 block text-sm font-medium text-ink";

const TEAM_SIZES = ["10-20", "20-50", "50+"];
const PRACTICE_TYPES = ["Astrology Institute", "Spiritual Centre", "Multi-astrologer Practice", "Other"];

// Reuses the SP-6.3 lead action. The Lead model has no source/org columns (backend changes are out of scope),
// so the enterprise context + a source tag are folded into the `message` field, composed client-side.
function EnterpriseForm({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(submitLeadAction, {});
  const [org, setOrg] = useState("");
  const [team, setTeam] = useState(TEAM_SIZES[0]);
  const [practice, setPractice] = useState(PRACTICE_TYPES[0]);
  const [notes, setNotes] = useState("");

  if (state.ok) {
    return (
      <div className="px-6 py-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green/15 text-green">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <h3 className="mt-4 font-display text-2xl text-ink">We got it!</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">Expect a message on your WhatsApp shortly.</p>
        <button type="button" onClick={onClose} className="mt-6 rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-marigold">Close</button>
      </div>
    );
  }

  const composedMessage = `Enterprise enquiry (source: enterprise_pricing) · Organisation: ${org || "—"} · Team size: ${team} · Practice: ${practice}${notes.trim() ? `\n\n${notes.trim()}` : ""}`;

  return (
    <form action={action} className="px-6 pb-6 pt-5 sm:px-7">
      <h3 className="font-display text-2xl text-ink">Tell us about your practice</h3>
      <p className="mt-1 text-sm text-muted">We&apos;ll get back to you on WhatsApp within 24 hours.</p>

      <input type="hidden" name="message" value={composedMessage} />
      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="ent-name" className={labelCls}>Your name <span className="text-terra">*</span></label>
          <input id="ent-name" name="name" required autoComplete="name" className={fieldCls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ent-org" className={labelCls}>Organisation / practice name <span className="text-terra">*</span></label>
          <input id="ent-org" required value={org} onChange={(e) => setOrg(e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="ent-email" className={labelCls}>Email <span className="text-terra">*</span></label>
          <input id="ent-email" name="email" type="email" required autoComplete="email" className={fieldCls} />
        </div>
        <div>
          <label htmlFor="ent-wa" className={labelCls}>WhatsApp number <span className="text-terra">*</span></label>
          <input id="ent-wa" name="whatsapp" required inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" className={fieldCls} />
        </div>
        <div>
          <label htmlFor="ent-team" className={labelCls}>Team members</label>
          <select id="ent-team" value={team} onChange={(e) => setTeam(e.target.value)} className={fieldCls}>
            {TEAM_SIZES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ent-practice" className={labelCls}>Type of practice</label>
          <select id="ent-practice" value={practice} onChange={(e) => setPractice(e.target.value)} className={fieldCls}>
            {PRACTICE_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="ent-notes" className={labelCls}>Anything else</label>
          <textarea id="ent-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tell us about your needs…" className={fieldCls} />
        </div>
      </div>

      {state.error && <p className="mt-3 text-sm text-terra">{state.error}</p>}
      <button type="submit" disabled={pending} className="mt-5 w-full rounded-full bg-marigold px-6 py-3 text-sm font-semibold text-night transition hover:-translate-y-0.5 disabled:opacity-60">
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}

export function EnterpriseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div onClick={onClose} aria-hidden className="absolute inset-0 bg-night/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contact us about Enterprise"
        className="relative max-h-[92vh] w-full overflow-auto rounded-t-card bg-sand shadow-2xl sm:max-w-lg sm:rounded-card"
      >
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-sand-2">✕</button>
        <EnterpriseForm onClose={onClose} />
      </div>
    </div>
  );
}
