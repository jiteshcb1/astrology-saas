"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SlugField } from "@/components/ui/SlugField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { QuestionsBuilder } from "@/components/dashboard/QuestionsBuilder";
import { AiQuestionnaire, type AiAnswers, type AiStep } from "@/components/dashboard/AiQuestionnaire";
import { PackageCard } from "@/components/public/PackageCard";
import { formatMoney } from "@/lib/money";
import { DURATION_OPTIONS, type PackageFormState } from "@/lib/packages";
import type { QuestionInput } from "@/lib/booking-validate";
import {
  checkPackageSlugAction,
  savePackageAction,
  generatePackageContentAction,
  generateIntakeQuestionsAction,
} from "@/app/dashboard/packages/actions";

const PACKAGE_STEPS: AiStep[] = [
  { id: "purpose", type: "single", question: "What is this session mainly for?", options: ["Career guidance", "Marriage compatibility", "Life path & purpose", "Business decisions", "General reading"] },
  { id: "deliverables", type: "multi", question: "What will the seeker receive?", helper: "Pick all that apply.", options: ["Detailed chart analysis", "Personalized remedies", "Q&A discussion", "Written report after", "Recorded session", "Action plan"] },
  { id: "audience", type: "single", question: "Who is this session best for?", options: ["First-time seekers", "Those at a crossroads", "Experienced spiritual seekers", "Anyone curious about astrology", "Professionals & business owners"] },
  { id: "prepare", type: "multi", question: "What should the seeker prepare or bring?", helper: "Pick all that apply.", options: ["Birth date/time/place", "Specific questions ready", "Nothing — I'll guide them", "Recent photos for palmistry", "Property/business details for Vastu"] },
  { id: "unique", type: "text", question: "What makes this session unique?", helper: "Optional.", placeholder: "e.g. Includes a follow-up voice note with remedies", skippable: true },
  { id: "results", type: "text", question: "What results have past seekers experienced?", helper: "Optional.", placeholder: "e.g. Clarity on career switch, found the right marriage timing", skippable: true },
  { id: "tone", type: "single", question: "What tone for the description?", options: ["Warm & reassuring", "Mystical & evocative", "Clear & practical", "Professional & detailed"] },
];

export interface PackageFormDefaults {
  id?: string;
  title: string;
  slug: string;
  description: string;
  allowedDurations: number[];
  defaultDurationMin: number;
  allowBookerChooseDuration: boolean;
  priceRupees: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotIntervalMin: number;
  per_day: string;
  per_week: string;
  per_month: string;
  questions: QuestionInput[];
}

export function PackageForm({
  defaults,
  bookingBase,
  themeColor,
  aiEnabled = false,
}: {
  defaults: PackageFormDefaults;
  bookingBase: string;
  themeColor?: string | null;
  aiEnabled?: boolean;
}) {
  const [state, action, pending] = useActionState<PackageFormState, FormData>(savePackageAction, {});
  const [slugReady, setSlugReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotice, setAiNotice] = useState(false);
  const [genQ, setGenQ] = useState(false);
  const [qNotice, setQNotice] = useState<string | null>(null);

  // Controlled state drives both submission and the live preview.
  const [title, setTitle] = useState(defaults.title);
  const [descriptionHtml, setDescriptionHtml] = useState(defaults.description);
  const [allowChoose, setAllowChoose] = useState(defaults.allowBookerChooseDuration);
  const [durations, setDurations] = useState<number[]>(
    defaults.allowedDurations.length ? defaults.allowedDurations : [defaults.defaultDurationMin],
  );
  const [defaultDuration, setDefaultDuration] = useState(defaults.defaultDurationMin);
  const [priceRupees, setPriceRupees] = useState(defaults.priceRupees);
  const [questions, setQuestions] = useState<QuestionInput[]>(defaults.questions);

  // What the server actually receives. When the seeker can't choose, the only duration is the default.
  const effectiveDurations = allowChoose ? [...durations].sort((a, b) => a - b) : [defaultDuration];
  const defaultOptions = allowChoose ? effectiveDurations : [...DURATION_OPTIONS];

  function toggleDuration(d: number) {
    setDurations((cur) => {
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
      const safe = next.length ? next : [d]; // never empty
      if (!safe.includes(defaultDuration)) setDefaultDuration([...safe].sort((a, b) => a - b)[0]);
      return safe;
    });
  }

  const priceNum = Math.round((parseFloat(priceRupees) || 0) * 100);
  const durationLabel = allowChoose ? `${effectiveDurations.join("/")} min` : `${defaultDuration} min`;

  async function onGenerate(answers: AiAnswers) {
    const res = await generatePackageContentAction(answers, { title, durationLabel });
    if (!res.ok) return { ok: false as const };
    if (res.data.description) setDescriptionHtml(res.data.description);
    if (!title.trim() && res.data.title) setTitle(res.data.title);
    setAiNotice(true);
    return { ok: true as const };
  }

  async function onGenerateQuestions() {
    setGenQ(true);
    setQNotice(null);
    const res = await generateIntakeQuestionsAction({ title, description: descriptionHtml });
    setGenQ(false);
    if (!res.ok) return setQNotice("Couldn't generate questions right now — add them manually.");
    setQuestions((cur) => [...cur, ...res.data.questions]);
    setQNotice(`✓ Added ${res.data.questions.length} question${res.data.questions.length === 1 ? "" : "s"} — review and edit.`);
  }

  return (
    <form action={action}>
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="description" value={descriptionHtml} />
      {effectiveDurations.map((d) => (
        <input key={d} type="hidden" name="durations" value={d} />
      ))}
      <input type="hidden" name="defaultDurationMin" value={defaultDuration} />
      <input type="hidden" name="questions" value={JSON.stringify(questions)} />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ── Form ── */}
        <div className="min-w-0 space-y-5">
          {aiEnabled && (
            <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-marigold/50 bg-marigold/5 px-4 py-3">
              <p className="text-sm text-ink">Let AI draft this package for you.</p>
              <Button type="button" className="shrink-0" onClick={() => setAiOpen(true)}>Start with AI ✨</Button>
            </div>
          )}

          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Details</h2>
            <div className="space-y-3">
              <Input name="title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kundali Reading" required />
              <SlugField
                name="slug"
                label="Booking link"
                bookingBase={bookingBase}
                initialValue={defaults.slug}
                placeholder="kundali-reading"
                checkAvailability={(slug) => checkPackageSlugAction(slug, defaults.id)}
                onValidityChange={setSlugReady}
              />
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">Description</span>
                  {aiEnabled && (
                    <button type="button" onClick={() => setAiOpen(true)} className="text-xs font-medium text-marigold hover:underline">Generate with AI ✨</button>
                  )}
                </div>
                {aiNotice && <p className="mb-2 rounded-control bg-marigold/10 px-3 py-2 text-xs text-ink">✓ Generated — review and edit before saving.</p>}
                <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg text-ink">Duration &amp; price</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="allowBookerChooseDuration"
                  checked={allowChoose}
                  onChange={(e) => setAllowChoose(e.target.checked)}
                  className="h-4 w-4 accent-marigold"
                />
                Let the seeker choose the duration
              </label>

              {allowChoose && (
                <div>
                  <span className="mb-1.5 block text-sm text-muted">Allowed durations</span>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((d) => {
                      const on = durations.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDuration(d)}
                          className={`rounded-control border px-3 py-1.5 text-sm transition ${
                            on ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"
                          }`}
                        >
                          {d} min
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={allowChoose ? "Default duration" : "Duration"}
                  value={String(defaultDuration)}
                  onChange={(e) => setDefaultDuration(parseInt(e.target.value, 10))}
                >
                  {defaultOptions.map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </Select>
                <Input
                  name="priceRupees"
                  type="number"
                  min="0"
                  step="1"
                  label="Price (₹)"
                  value={priceRupees}
                  onChange={(e) => setPriceRupees(e.target.value)}
                  placeholder="1100"
                  required
                />
              </div>
              <p className="text-xs text-muted">Location is Google Meet (added automatically on confirmation).</p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-display text-lg text-ink">Booking limits</h2>
            <p className="mb-3 text-sm text-muted">Protect your calendar. Slots are computed to respect these.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="bufferBeforeMin" type="number" min="0" label="Buffer before (min)" defaultValue={String(defaults.bufferBeforeMin)} />
              <Input name="bufferAfterMin" type="number" min="0" label="Buffer after (min)" defaultValue={String(defaults.bufferAfterMin)} />
              <Input name="minNoticeMin" type="number" min="0" label="Minimum notice (min)" defaultValue={String(defaults.minNoticeMin)} />
              <Input name="slotIntervalMin" type="number" min="5" label="Slot interval (min)" defaultValue={String(defaults.slotIntervalMin)} />
              <Input name="per_day" type="number" min="0" label="Max per day (optional)" defaultValue={defaults.per_day} />
              <Input name="per_week" type="number" min="0" label="Max per week (optional)" defaultValue={defaults.per_week} />
              <Input name="per_month" type="number" min="0" label="Max per month (optional)" defaultValue={defaults.per_month} />
            </div>
          </Card>

          <Card>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg text-ink">Booking questions</h2>
              {aiEnabled && (
                <button type="button" onClick={onGenerateQuestions} disabled={genQ} className="text-xs font-medium text-marigold hover:underline disabled:opacity-50">
                  {genQ ? "Generating…" : "Generate with AI ✨"}
                </button>
              )}
            </div>
            <p className="mb-3 text-sm text-muted">Asked on the booking form before a seeker confirms. Hidden questions aren&apos;t shown.</p>
            {qNotice && <p className="mb-3 rounded-control bg-marigold/10 px-3 py-2 text-xs text-ink">{qNotice}</p>}
            <QuestionsBuilder value={questions} onChange={setQuestions} />
          </Card>

          {state.error && <p className="text-sm text-terra">{state.error}</p>}
          <Button type="submit" disabled={pending || !slugReady}>{pending ? "Saving…" : "Save package"}</Button>
        </div>

        {/* ── Live preview ── */}
        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-sm text-muted">Preview — how seekers see this</p>
          <PackageCard
            title={title}
            durationLabel={durationLabel}
            priceLabel={formatMoney(priceNum)}
            descriptionHtml={descriptionHtml}
            themeColor={themeColor}
          />
        </div>
      </div>

      {aiEnabled && (
        <AiQuestionnaire open={aiOpen} onClose={() => setAiOpen(false)} title="Generate your package" generateLabel="Generate description ✨" steps={PACKAGE_STEPS} onGenerate={onGenerate} />
      )}
    </form>
  );
}
