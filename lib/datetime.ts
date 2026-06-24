// Pure date/time helpers shared by the UI pickers (components/ui/TimePicker, DatePicker,
// DateTimePicker, DateTimeRange). Pickers speak LOCAL WALL-CLOCK STRINGS so there's no timezone
// ambiguity inside the UI; callers convert to UTC at the storage boundary via lib/timezone. Formats:
//   time      → "HH:mm"            (24h, zero-padded)
//   date      → "YYYY-MM-DD"
//   datetime  → "YYYY-MM-DDTHH:mm"
// All three sort correctly with plain string comparison, which is what the range logic relies on
// (no Date math, so no DST/leap/boundary surprises for wall-clock comparisons).

export type RangeValidity = { valid: boolean; reason?: string };

// ── Comparison ────────────────────────────────────────────────────────────────
export function compareTime(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function compareDateTime(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// A range is valid when both ends are present and start is strictly before end.
export function isValidRange(start: string, end: string): boolean {
  return Boolean(start) && Boolean(end) && start < end;
}

// Validity + a human reason, for forms to block save and show a message.
export function rangeValidity(start: string, end: string, opts: { required?: boolean } = {}): RangeValidity {
  const haveStart = Boolean(start);
  const haveEnd = Boolean(end);
  if (!haveStart && !haveEnd) {
    return opts.required ? { valid: false, reason: "Required." } : { valid: true };
  }
  if (!haveStart || !haveEnd) return { valid: false, reason: "Both a start and end are needed." };
  if (!(start < end)) return { valid: false, reason: "End must be after start." };
  return { valid: true };
}

// When a start changes, drop an end that's no longer strictly after it (graceful reconcile — never
// leave an invalid range sitting in state). Returns the end to keep ("" to clear).
export function reconcileEnd(start: string, end: string): string {
  if (!start || !end) return end;
  return end > start ? end : "";
}

// ── Time options ──────────────────────────────────────────────────────────────
// Stepped "HH:mm" across the day, optionally bounded (inclusive) by min/max.
export function timeOptions(stepMin = 15, bounds: { min?: string; max?: string } = {}): string[] {
  const step = stepMin > 0 ? stepMin : 15;
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (bounds.min && t < bounds.min) continue;
    if (bounds.max && t > bounds.max) continue;
    out.push(t);
  }
  return out;
}

// Floor a "HH:mm" to the nearest lower step boundary.
export function clampToStep(time: string, stepMin: number): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + Math.floor(m / stepMin) * stepMin;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ── Display formatting (pure; tz-safe by formatting in UTC) ─────────────────────
export function formatTime(time: string, hour12 = true): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return "";
  const [h, m] = time.split(":").map(Number);
  if (!hour12) return time;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function formatDateLabel(dateISO: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return "";
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, mo - 1, d)));
}

// ── ISO ↔ Date (calendar-only; constructed in local time, day-accurate) ─────────
export function isoToDate(dateISO: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return undefined;
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Date(y, mo - 1, d); // local midnight; react-day-picker compares by calendar day
}
export function dateToISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── datetime split/join ─────────────────────────────────────────────────────────
export function splitDateTime(dt: string): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const [date, time] = dt.split("T");
  return { date: date ?? "", time: time ?? "" };
}
export function joinDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : "";
}
