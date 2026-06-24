"use client";

import {
  QUESTION_FIELD_TYPES,
  QUESTION_REQUIREMENTS,
  QUESTION_TYPE_LABELS,
  type QuestionInput,
} from "@/lib/booking-validate";

const REQUIREMENT_LABELS: Record<string, string> = { required: "Required", optional: "Optional", hidden: "Hidden" };
const selectCls = "rounded-control border border-line bg-white px-2.5 py-2 text-sm text-ink outline-none transition focus:border-marigold";
const inputCls = "w-full rounded-control border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-marigold";

// Consultant-side builder for a package's pre-booking intake questions (SP-4.2, folds in the deferred
// SP-3.4 builder). Controlled — PackageForm serializes `value` into a hidden field on submit.
export function QuestionsBuilder({ value, onChange }: { value: QuestionInput[]; onChange: (q: QuestionInput[]) => void }) {
  function update(i: number, patch: Partial<QuestionInput>) {
    onChange(value.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    onChange([...value, { label: "", fieldType: "short_text", requirement: "optional", options: [] }]);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-muted">No questions yet. Add what you need from seekers before a session (e.g. date of birth, place of birth).</p>
      )}

      {value.map((q, i) => (
        <div key={i} className="rounded-card border border-line p-3">
          <div className="flex items-start gap-2">
            <input
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Question (e.g. Date of birth)"
              className={inputCls}
            />
            <div className="flex shrink-0 flex-col gap-1">
              <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-control border border-line px-2 text-xs text-muted disabled:opacity-30 hover:enabled:border-marigold">▲</button>
              <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded-control border border-line px-2 text-xs text-muted disabled:opacity-30 hover:enabled:border-marigold">▼</button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={q.fieldType} onChange={(e) => update(i, { fieldType: e.target.value as QuestionInput["fieldType"] })} className={selectCls}>
              {QUESTION_FIELD_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
            </select>
            <select value={q.requirement} onChange={(e) => update(i, { requirement: e.target.value as QuestionInput["requirement"] })} className={selectCls}>
              {QUESTION_REQUIREMENTS.map((r) => <option key={r} value={r}>{REQUIREMENT_LABELS[r]}</option>)}
            </select>
            <button type="button" onClick={() => remove(i)} className="ml-auto rounded-control border border-line px-3 py-2 text-sm text-terra transition hover:border-terra">Remove</button>
          </div>

          {q.fieldType === "select" && (
            <input
              value={q.options.join(", ")}
              onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trimStart()) })}
              placeholder="Options, comma-separated (e.g. Morning, Afternoon, Evening)"
              className={`${inputCls} mt-2`}
            />
          )}
        </div>
      ))}

      <button type="button" onClick={add} className="rounded-control border border-dashed border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">
        + Add question
      </button>
    </div>
  );
}
