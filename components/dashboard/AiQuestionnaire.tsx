"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface AiStep {
  id: string;
  question: string;
  helper?: string;
  type: "single" | "multi" | "text";
  options?: string[];
  skippable?: boolean;
  placeholder?: string;
}
export type AiAnswers = Record<string, string | string[]>;

// Generic one-question-at-a-time assistant (SP-4.6). The parent supplies the steps + an async onGenerate
// that calls the AI server action and applies the result to the form; this drives the UI/flow only.
export function AiQuestionnaire({
  open,
  onClose,
  title,
  steps,
  generateLabel = "Generate ✨",
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: AiStep[];
  generateLabel?: string;
  onGenerate: (answers: AiAnswers) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AiAnswers>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the first step each time the assistant opens.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdx(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !generating) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, generating]);

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const current = answers[step?.id];
  const answered = step?.type === "multi" ? Array.isArray(current) && current.length > 0 : Boolean(current);

  function setAnswer(v: string | string[]) {
    setAnswers((a) => ({ ...a, [step.id]: v }));
  }
  function next() {
    if (idx < steps.length - 1) setIdx(idx + 1);
  }
  function pickSingle(opt: string) {
    setAnswer(opt);
    if (!isLast) setIdx(idx + 1); // auto-advance
  }
  function toggleMulti(opt: string) {
    const arr = Array.isArray(current) ? current : [];
    setAnswer(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    const res = await onGenerate(answers);
    setGenerating(false);
    if (res.ok) onClose();
    else setError(res.error || "Couldn't generate content right now — you can fill this in manually.");
  }

  if (!step) return null;

  return (
    <>
      <div onClick={() => !generating && onClose()} aria-hidden className={`fixed inset-0 z-40 bg-night/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-hidden={!open} className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg text-ink">{title}</h2>
            <button type="button" aria-label="Close" onClick={() => !generating && onClose()} className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-sand-2/60">✕</button>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">Step {idx + 1} of {steps.length}</div>
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-marigold transition-all duration-300" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {generating ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="animate-pulse text-3xl">✨</div>
            <p className="font-display text-lg text-ink">Writing your content…</p>
            <p className="text-sm text-muted">This takes a few seconds.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <h3 className="font-display text-xl text-ink">{step.question}</h3>
            {step.helper && <p className="mt-1 text-sm text-muted">{step.helper}</p>}

            <div className="mt-4">
              {step.type === "text" ? (
                <textarea
                  rows={3}
                  value={typeof current === "string" ? current : ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={step.placeholder}
                  className="w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-marigold"
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(step.options ?? []).map((opt) => {
                    const sel = step.type === "multi" ? Array.isArray(current) && current.includes(opt) : current === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => (step.type === "multi" ? toggleMulti(opt) : pickSingle(opt))}
                        className={`rounded-control border px-3.5 py-2 text-sm transition ${sel ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {error && <p className="mt-4 rounded-control bg-terra/10 px-3 py-2 text-sm text-terra">{error}</p>}
          </div>
        )}

        {!generating && (
          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-4">
            <button type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="rounded-control px-3 py-2 text-sm text-muted disabled:opacity-30 hover:enabled:text-ink">← Back</button>
            <div className="flex items-center gap-2">
              {step.skippable && step.type === "text" && !isLast && (
                <button type="button" onClick={() => { setAnswer(""); next(); }} className="rounded-control px-3 py-2 text-sm text-muted hover:text-ink">Skip</button>
              )}
              {isLast ? (
                <Button type="button" onClick={generate} disabled={!answered && !step.skippable}>{generateLabel}</Button>
              ) : step.type !== "single" ? (
                <Button type="button" onClick={next} disabled={!answered && !step.skippable}>Next →</Button>
              ) : null}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
