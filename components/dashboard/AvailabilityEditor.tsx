"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TimePicker } from "@/components/ui/TimePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { reconcileEnd } from "@/lib/datetime";
import type { AvailabilityFormState } from "@/lib/availability";
import { saveAvailabilityAction } from "@/app/dashboard/availability/actions";

interface Range {
  start: string;
  end: string;
}
interface DayState {
  weekday: number;
  enabled: boolean;
  ranges: Range[];
}
export interface OverrideState {
  date: string;
  isUnavailable: boolean;
  start: string;
  end: string;
}

// Display Monday-first; weekday index stays 0=Sun … 6=Sat.
const DAYS = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

// India-first + major global zones. Offset labels are computed live (DST-correct).
const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Karachi", "Asia/Dhaka", "Asia/Kathmandu", "Asia/Colombo",
  "Asia/Singapore", "Asia/Bangkok", "Asia/Tokyo", "Australia/Sydney",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Pacific/Auckland", "UTC",
];

function tzLabel(tz: string): string {
  if (tz === "UTC") return "UTC (UTC+00:00)";
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz} (${name.replace("GMT", "UTC")})`;
  } catch {
    return tz;
  }
}

function format12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

// Indices of ranges (within one day) that overlap any other complete range that day.
function overlappingIndices(ranges: Range[]): Set<number> {
  const set = new Set<number>();
  const items = ranges
    .map((r, i) => ({ i, start: r.start, end: r.end }))
    .filter((x) => x.start && x.end && x.start < x.end);
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      if (items[a].start < items[b].end && items[b].start < items[a].end) {
        set.add(items[a].i);
        set.add(items[b].i);
      }
    }
  }
  return set;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-line text-base leading-none text-muted transition hover:border-terra hover:text-terra"
    >
      ✕
    </button>
  );
}

export function AvailabilityEditor({
  defaults,
}: {
  defaults: { timezone: string; week: DayState[]; overrides: OverrideState[] };
}) {
  const [state, action, pending] = useActionState<AvailabilityFormState, FormData>(saveAvailabilityAction, {});
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [week, setWeek] = useState<DayState[]>(defaults.week);
  const [overrides, setOverrides] = useState<OverrideState[]>(defaults.overrides);

  // React 19 auto-resets the <form> after a successful action, which can drift the controlled time
  // <select>s out of sync with state. Bump a nonce when the action result changes and key the time
  // inputs on it, so they remount from the (correct) state values after each save. (No effect — state
  // adjustment during render, the React-recommended pattern.)
  const [nonce, setNonce] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setNonce((n) => n + 1);
  }

  const setDay = (weekday: number, patch: Partial<DayState>) =>
    setWeek((w) => w.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  const setRange = (weekday: number, idx: number, patch: Partial<Range>) =>
    setWeek((w) =>
      w.map((d) =>
        d.weekday === weekday ? { ...d, ranges: d.ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } : d,
      ),
    );
  const addRange = (weekday: number) =>
    setWeek((w) => w.map((d) => (d.weekday === weekday ? { ...d, ranges: [...d.ranges, { start: "", end: "" }] } : d)));
  const removeRange = (weekday: number, idx: number) =>
    setWeek((w) => w.map((d) => (d.weekday === weekday ? { ...d, ranges: d.ranges.filter((_, i) => i !== idx) } : d)));

  const updateOverride = (idx: number, patch: Partial<OverrideState>) =>
    setOverrides((arr) => arr.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  // Copy the first enabled day's ranges to every enabled day.
  const copyToAll = () => {
    const source = week.find((d) => d.enabled && d.ranges.length);
    if (!source) return;
    setWeek((w) => w.map((d) => (d.enabled ? { ...d, ranges: source.ranges.map((r) => ({ ...r })) } : d)));
  };

  // ── Validation (client) ─────────────────────────────────────────────────────
  const blockingIssues = new Set<string>();
  let hasOverlap = false;
  for (const day of week) {
    if (!day.enabled) continue;
    const label = DAYS.find((d) => d.weekday === day.weekday)?.label ?? "";
    for (const r of day.ranges) {
      if (!r.start || !r.end) blockingIssues.add(`${label}: finish or remove the incomplete time range.`);
      else if (r.start >= r.end) blockingIssues.add(`${label}: start must be before end (${format12(r.start)} – ${format12(r.end)}).`);
    }
    if (overlappingIndices(day.ranges).size > 0) hasOverlap = true;
  }
  for (const o of overrides) {
    if (!o.date) {
      blockingIssues.add("An override is missing its date — add one or remove the row.");
      continue;
    }
    if (!o.isUnavailable) {
      if (!o.start || !o.end) blockingIssues.add(`Override ${o.date}: finish or remove the custom hours.`);
      else if (o.start >= o.end) blockingIssues.add(`Override ${o.date}: start must be before end.`);
    }
  }
  const blockSave = blockingIssues.size > 0 || hasOverlap;

  // ── Serialize (only complete + valid ranges) ────────────────────────────────
  const rules = week
    .filter((d) => d.enabled)
    .flatMap((d) =>
      d.ranges
        .filter((r) => r.start && r.end && r.start < r.end)
        .map((r) => ({ weekday: d.weekday, startTime: r.start, endTime: r.end })),
    );
  const overridesPayload = overrides
    .filter((o) => o.date)
    .map((o) => ({ date: o.date, isUnavailable: o.isUnavailable, startTime: o.isUnavailable ? null : o.start, endTime: o.isUnavailable ? null : o.end }));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="rulesJson" value={JSON.stringify(rules)} />
      <input type="hidden" name="overridesJson" value={JSON.stringify(overridesPayload)} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-ink">Working hours</h2>
            <p className="text-sm text-muted">Times are in your timezone. Seekers see slots in theirs.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-60">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-10 py-0">
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tzLabel(tz)}</option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="ghost" className="h-10 py-0" onClick={copyToAll}>Copy to all days</Button>
          </div>
        </div>

        <div key={nonce} className="mt-4 divide-y divide-line">
          {DAYS.map(({ weekday, label }) => {
            const day = week.find((d) => d.weekday === weekday)!;
            const dayOverlaps = overlappingIndices(day.ranges);
            return (
              <div key={weekday} className="flex flex-wrap items-start gap-4 py-3.5">
                <label className="flex w-36 shrink-0 items-center gap-2 pt-1.5 text-sm text-ink">
                  <input type="checkbox" checked={day.enabled} onChange={(e) => setDay(weekday, { enabled: e.target.checked })} className="h-4 w-4 accent-marigold" />
                  {label}
                </label>
                {!day.enabled ? (
                  <span className="pt-1.5 text-sm text-muted">Unavailable</span>
                ) : (
                  <div className="flex flex-1 flex-col gap-2.5">
                    {day.ranges.map((r, idx) => {
                      const overlapping = dayOverlaps.has(idx);
                      return (
                        <div key={idx}>
                          <div className="flex flex-wrap items-center gap-2">
                            <TimePicker
                              value={r.start}
                              onChange={(v) => setRange(weekday, idx, { start: v, end: reconcileEnd(v, r.end) })}
                            />
                            <span className="text-muted">–</span>
                            <TimePicker
                              value={r.end}
                              min={r.start || undefined}
                              onChange={(v) => setRange(weekday, idx, { end: v })}
                            />
                            <RemoveButton onClick={() => removeRange(weekday, idx)} label="Remove range" />
                          </div>
                          {overlapping && (
                            <p className="mt-1 text-xs text-terra">Overlaps another range — adjust or remove it.</p>
                          )}
                        </div>
                      );
                    })}
                    <Button type="button" variant="ghost" className="h-10 self-start text-sm" onClick={() => addRange(weekday)}>
                      + Add range
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg text-ink">Date overrides</h2>
            <p className="text-sm text-muted">Close a specific date or set custom hours.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setOverrides((o) => [...o, { date: "", isUnavailable: true, start: "", end: "" }])}>
            + Add override
          </Button>
        </div>
        {overrides.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No overrides — your weekly hours apply every week.</p>
        ) : (
          <div key={nonce} className="mt-3 space-y-2.5">
            {overrides.map((o, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2.5">
                <DatePicker value={o.date} onChange={(v) => updateOverride(idx, { date: v })} placeholder="Pick a date" />
                <div className="inline-flex h-10 items-center rounded-control border border-line p-1">
                  <button
                    type="button"
                    onClick={() => updateOverride(idx, { isUnavailable: true })}
                    className={`h-full rounded-[7px] px-3 text-sm transition ${o.isUnavailable ? "bg-marigold font-medium text-night" : "text-muted hover:text-ink"}`}
                  >
                    Unavailable all day
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOverride(idx, { isUnavailable: false })}
                    className={`h-full rounded-[7px] px-3 text-sm transition ${!o.isUnavailable ? "bg-marigold font-medium text-night" : "text-muted hover:text-ink"}`}
                  >
                    Custom hours
                  </button>
                </div>
                {!o.isUnavailable && (
                  <>
                    <TimePicker
                      value={o.start}
                      onChange={(v) => updateOverride(idx, { start: v, end: reconcileEnd(v, o.end) })}
                    />
                    <span className="text-muted">–</span>
                    <TimePicker value={o.end} min={o.start || undefined} onChange={(v) => updateOverride(idx, { end: v })} />
                  </>
                )}
                <RemoveButton onClick={() => setOverrides((arr) => arr.filter((_, i) => i !== idx))} label="Remove override" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm text-muted">
          Booking limits (buffers, minimum notice, frequency caps) live on each <strong>package</strong>,
          so different consultation types can have different rules.
        </p>
      </Card>

      {blockingIssues.size > 0 && (
        <div className="rounded-control border border-terra/40 bg-terra/5 px-4 py-3 text-sm text-terra">
          <p className="font-medium">Fix these before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {[...blockingIssues].map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
      {state.error && <p className="text-sm text-terra">{state.error}</p>}
      {state.ok && <p className="text-sm text-green">Availability saved.</p>}
      <Button type="submit" loading={pending} disabled={blockSave} loadingLabel="Saving…">Save availability</Button>
    </form>
  );
}
