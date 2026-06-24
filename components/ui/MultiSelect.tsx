"use client";

import { useEffect, useRef, useState } from "react";

// Accessible-ish multiselect dropdown. Submits the selection as a comma-joined hidden input
// (so server actions can parse it like a CSV). No external dependency.
export function MultiSelect({
  name,
  label,
  options,
  defaultValue = [],
  placeholder = "Select…",
  onChange,
}: {
  name: string;
  label?: string;
  options: string[];
  defaultValue?: string[];
  placeholder?: string;
  onChange?: (values: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const apply = (next: string[]) => {
    setSelected(next);
    onChange?.(next);
  };
  const toggle = (opt: string) =>
    apply(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  const remove = (opt: string) => apply(selected.filter((x) => x !== opt));

  return (
    <div ref={ref} className="relative">
      {label && <span className="mb-1.5 block text-sm text-muted">{label}</span>}
      <input type="hidden" name={name} value={selected.join(",")} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-control border border-line bg-white px-3 py-2 text-left text-sm outline-none transition focus:border-marigold"
      >
        {selected.length === 0 ? (
          <span className="text-muted">{placeholder}</span>
        ) : (
          selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-marigold/15 px-2 py-0.5 text-xs text-ink">
              {s}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Remove ${s}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(s);
                }}
                className="cursor-pointer text-muted hover:text-terra"
              >
                ×
              </span>
            </span>
          ))
        )}
        <svg className="ml-auto text-muted" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-control border border-line bg-white py-1 shadow-[0_10px_30px_rgba(20,18,43,0.1)]">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-sand-2/50 ${active ? "text-ink" : "text-muted"}`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${active ? "border-marigold bg-marigold text-night" : "border-line"}`}>
                  {active ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
