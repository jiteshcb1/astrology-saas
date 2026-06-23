"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateSlugInput, type SlugInputEval } from "@/lib/slug";

type CheckAvailability = (slug: string) => Promise<{ available: boolean; reason?: string }>;

export function SlugField({
  name = "slug",
  label = "Slug (booking URL)",
  bookingBase,
  checkAvailability,
  onValidityChange,
}: {
  name?: string;
  label?: string;
  bookingBase: string;
  checkAvailability: CheckAvailability;
  onValidityChange?: (ready: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<SlugInputEval>(() => evaluateSlugInput(""));
  const [avail, setAvail] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [availMsg, setAvailMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  function evaluate(raw: string, typing: boolean) {
    const r = evaluateSlugInput(raw, { typing });
    setValue(r.display);
    setResult(r);
    setAvail("idle");
    setAvailMsg("");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (r.status === "ok") {
      const id = ++reqIdRef.current;
      setAvail("checking");
      debounceRef.current = setTimeout(() => {
        void checkAvailability(r.canonical).then((res) => {
          if (id !== reqIdRef.current) return; // ignore stale responses
          if (res.available) {
            setAvail("available");
          } else {
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

  const error = result.status === "error" ? result.message : avail === "taken" ? availMsg : undefined;
  const ok = result.status === "ok" && avail === "available";

  useEffect(() => {
    onValidityChange?.(ok);
  }, [ok, onValidityChange]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">{label}</span>
        <input
          value={value}
          onChange={(e) => evaluate(e.target.value, true)}
          onBlur={(e) => evaluate(e.target.value, false)}
          placeholder="jyoti-astrology"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className={`w-full rounded-control border bg-white px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-marigold ${
            error ? "border-terra" : ok ? "border-green" : "border-line"
          }`}
          required
        />
      </label>
      {/* Canonical value actually submitted (trailing hyphen trimmed). */}
      <input type="hidden" name={name} value={result.canonical} />

      <p className="mt-1 text-xs text-muted">
        {bookingBase}/<span className="text-ink">{result.canonical || "your-slug"}</span>
      </p>
      {result.note && <p className="mt-1 text-xs text-muted">{result.note}</p>}
      {avail === "checking" && <p className="mt-1 text-xs text-muted">Checking availability…</p>}
      {ok && <p className="mt-1 text-xs text-green">✓ Available</p>}
      {error && <p className="mt-1 text-xs text-terra">{error}</p>}
    </div>
  );
}
