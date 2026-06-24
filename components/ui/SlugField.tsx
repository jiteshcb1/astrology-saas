"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateSlugInput, type SlugInputEval } from "@/lib/slug";

type CheckAvailability = (slug: string) => Promise<{ available: boolean; reason?: string }>;

/**
 * Shared, compulsory slug field used everywhere a public URL slug is entered (consultant org,
 * packages, …). Spaces/symbols are converted to hyphens as you type (via evaluateSlugInput), shows a
 * live preview of the real link with a copy button, and optionally checks availability.
 *
 * Props:
 * - name            hidden input name submitted with the canonical slug (default "slug")
 * - bookingBase     the URL prefix, e.g. "https://app/jyoti" → preview "https://app/jyoti/<slug>"
 * - initialValue    prefill (e.g. when editing)
 * - checkAvailability  optional async availability check; omit to skip the availability UI
 * - onValidityChange   reports whether the current slug is valid (+ available, if checked)
 */
export function SlugField({
  name = "slug",
  label = "URL slug",
  bookingBase,
  initialValue = "",
  checkAvailability,
  onValidityChange,
  placeholder = "your-slug",
}: {
  name?: string;
  label?: string;
  bookingBase: string;
  initialValue?: string;
  checkAvailability?: CheckAvailability;
  onValidityChange?: (ready: boolean) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(() => evaluateSlugInput(initialValue).display);
  const [result, setResult] = useState<SlugInputEval>(() => evaluateSlugInput(initialValue));
  const [avail, setAvail] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [availMsg, setAvailMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  function evaluate(raw: string, typing: boolean) {
    const r = evaluateSlugInput(raw, { typing });
    setValue(r.display);
    setResult(r);
    setAvail("idle");
    setAvailMsg("");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (r.status === "ok" && checkAvailability) {
      const id = ++reqIdRef.current;
      setAvail("checking");
      debounceRef.current = setTimeout(() => {
        void checkAvailability(r.canonical).then((res) => {
          if (id !== reqIdRef.current) return; // ignore stale responses
          if (res.available) setAvail("available");
          else {
            setAvail("taken");
            setAvailMsg(res.reason === "taken" ? "That slug is already taken." : res.reason ?? "Unavailable.");
          }
        });
      }, 300);
    }
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Mount-only: verify a prefilled (edit) slug so it shows "Available" without the user touching the
  // field. setState only happens in the async callback (not synchronously in the effect).
  useEffect(() => {
    if (!initialValue || !checkAvailability) return;
    const init = evaluateSlugInput(initialValue);
    if (init.status !== "ok") return;
    const id = ++reqIdRef.current;
    void checkAvailability(init.canonical).then((res) => {
      if (id !== reqIdRef.current) return;
      setAvail(res.available ? "available" : "taken");
      if (!res.available) setAvailMsg(res.reason === "taken" ? "That slug is already taken." : res.reason ?? "Unavailable.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const error = result.status === "error" ? result.message : avail === "taken" ? availMsg : undefined;
  // Valid when the shape is ok and (availability not checked OR confirmed available).
  const ok = result.status === "ok" && (!checkAvailability || avail === "available");

  useEffect(() => {
    onValidityChange?.(ok);
  }, [ok, onValidityChange]);

  const base = bookingBase.replace(/\/$/, "");
  const fullUrl = `${base}/${result.canonical}`;

  function copy() {
    if (!result.canonical) return;
    navigator.clipboard?.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">
          {label} <span className="text-terra">*</span>
        </span>
        <input
          value={value}
          onChange={(e) => evaluate(e.target.value, true)}
          onBlur={(e) => evaluate(e.target.value, false)}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          required
          className={`w-full rounded-control border bg-white px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-marigold ${
            error ? "border-terra" : ok ? "border-green" : "border-line"
          }`}
        />
      </label>
      {/* Canonical value actually submitted (hyphens normalized, trailing hyphen trimmed). */}
      <input type="hidden" name={name} value={result.canonical} />

      {/* Live preview of the real link + copy. */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-control border border-line bg-sand-2/30 px-3 py-2">
        <div className="min-w-0 truncate text-sm">
          <span className="text-muted">{base}/</span>
          <span className="font-medium text-ink">{result.canonical || placeholder}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={!result.canonical}
          className="inline-flex shrink-0 items-center gap-1 rounded-control border border-line bg-white px-2.5 py-1 text-xs text-ink transition hover:border-marigold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" /></svg>
              Copy link
            </>
          )}
        </button>
      </div>

      {result.note && <p className="mt-1 text-xs text-muted">{result.note}</p>}
      {avail === "checking" && <p className="mt-1 text-xs text-muted">Checking availability…</p>}
      {ok && checkAvailability && <p className="mt-1 text-xs text-green">✓ Available</p>}
      {error && <p className="mt-1 text-xs text-terra">{error}</p>}
    </div>
  );
}
