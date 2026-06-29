"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { type LegalFormState } from "@/lib/legal";
import { formatStamp } from "@/lib/datetime";
import { saveLegalAction } from "@/app/dashboard/settings/legal/actions";

const PRIVACY_POINTS = [
  "We collect your name, email, phone and birth details only to provide your consultation.",
  "Your birth details, questions and session notes are kept confidential and never sold.",
  "Payments are processed securely by the payment provider; we do not store your card details.",
  "We may send booking confirmations and reminders by email or SMS.",
  "Cookies are used only to keep the booking page working.",
  "You can request a copy or deletion of your data by contacting us.",
];
const TERMS_POINTS = [
  "Consultations are for guidance and self-reflection, not a substitute for medical, legal or financial advice.",
  "A booking is confirmed only after successful payment or payment verification.",
  "Reschedules and refunds follow the policy stated at the time of booking.",
  "Please join your session on time; no-shows may not be eligible for a refund.",
  "Sessions are a respectful space; abusive behaviour may end the session without refund.",
  "Any recording is made and shared only with your consent.",
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
// Decode an HTML fragment to its plain, normalized text (for matching against a suggestion point).
function decodePlain(html: string): string {
  return norm(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"'),
  );
}
function liTexts(html: string): string[] {
  const out: string[] = [];
  html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => {
    out.push(decodePlain(inner));
    return "";
  });
  return out;
}
// Is this point already present as a bullet in the field?
function pointAdded(html: string, point: string): boolean {
  return liTexts(html).includes(norm(point));
}
// Append a point as a bullet (no-op if already present), merging into a trailing <ul>.
function addPoint(html: string, point: string): string {
  if (pointAdded(html, point)) return html;
  const li = `<li>${escapeHtml(point)}</li>`;
  const t = html.trim();
  if (/<\/ul>$/i.test(t)) return t.replace(/<\/ul>$/i, `${li}</ul>`);
  return t ? `${t}<ul>${li}</ul>` : `<ul>${li}</ul>`;
}
// Remove the bullet whose text matches the point; drop any now-empty list.
function removePoint(html: string, point: string): string {
  const target = norm(point);
  return html
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, inner) => (decodePlain(inner) === target ? "" : m))
    .replace(/<ul>\s*<\/ul>/gi, "")
    .replace(/<ol>\s*<\/ol>/gi, "");
}
function fmtDate(iso: string): string {
  return formatStamp(iso, { withYear: true });
}

function SuggestionRow({ points, value, onAdd, onRemove }: { points: string[]; value: string; onAdd: (p: string) => void; onRemove: (p: string) => void }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-muted">Suggested points — tap to add as a bullet, tap ✕ to remove:</p>
      <div className="flex flex-wrap gap-2">
        {points.map((p) => {
          const added = pointAdded(value, p);
          const label = p.length > 60 ? `${p.slice(0, 60)}…` : p;
          if (added) {
            return (
              <span key={p} className="inline-flex max-w-full items-center gap-1.5 rounded-control border border-green/40 bg-green/10 px-2.5 py-1.5 text-xs text-ink">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="shrink-0 text-green"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="truncate">{label}</span>
                <button type="button" onClick={() => onRemove(p)} aria-label="Remove point" className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-muted transition hover:bg-terra/15 hover:text-terra">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                </button>
              </span>
            );
          }
          return (
            <button key={p} type="button" onClick={() => onAdd(p)} className="max-w-full rounded-control border border-line px-2.5 py-1.5 text-left text-xs text-ink transition hover:border-marigold hover:bg-marigold/5">
              + {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LegalForm({ defaults }: { defaults: { privacyPolicy: string; termsConditions: string; updatedAtISO: string | null } }) {
  const [state, action, pending] = useActionState<LegalFormState, FormData>(saveLegalAction, {});
  const [privacy, setPrivacy] = useState(defaults.privacyPolicy);
  const [terms, setTerms] = useState(defaults.termsConditions);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="privacyPolicy" value={privacy} />
      <input type="hidden" name="termsConditions" value={terms} />

      <Card>
        <h2 className="font-display text-lg text-ink">Privacy Policy</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">How you handle seekers&apos; data. Shown on your public booking page.</p>
        <RichTextEditor value={privacy} onChange={setPrivacy} placeholder="Describe how you collect, use and protect seeker data…" />
        <SuggestionRow points={PRIVACY_POINTS} value={privacy} onAdd={(p) => setPrivacy((h) => addPoint(h, p))} onRemove={(p) => setPrivacy((h) => removePoint(h, p))} />
      </Card>

      <Card>
        <h2 className="font-display text-lg text-ink">Terms &amp; Conditions</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted">The rules seekers agree to when they book with you.</p>
        <RichTextEditor value={terms} onChange={setTerms} placeholder="Describe booking, payment, reschedule and conduct terms…" />
        <SuggestionRow points={TERMS_POINTS} value={terms} onAdd={(p) => setTerms((h) => addPoint(h, p))} onRemove={(p) => setTerms((h) => removePoint(h, p))} />
      </Card>

      {defaults.updatedAtISO && <p className="text-xs text-muted">Last updated {fmtDate(defaults.updatedAtISO)}</p>}
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Legal pages saved.</p>}
      <Button type="submit" loading={pending} loadingLabel="Saving…">Save legal pages</Button>
    </form>
  );
}
