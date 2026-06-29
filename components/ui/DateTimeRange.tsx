"use client";

import { DateTimePicker } from "./DateTimePicker";
import { rangeValidity, reconcileEnd } from "@/lib/datetime";

/**
 * Linked start/end timestamp range — the canonical "range mode" two pickers. The end picker's `min`
 * is bound to the start, so earlier dates/times are greyed and an invalid end can't be picked. When
 * the start moves past the current end, the end is reconciled (cleared) so an invalid range never
 * exists. Validity is surfaced on every change for the form to block save + show a message.
 *
 * Props:
 * - value            { start, end } as "YYYY-MM-DDTHH:mm" ("" empty)
 * - onChange         ({ start, end, valid, reason }) — reason set when invalid
 * - min              optional floor for the start (e.g. now, for bookings)
 * - required, disabledDate, minuteStep (15), hour12, size, startLabel, endLabel
 */
export interface RangeValue {
  start: string;
  end: string;
}
export interface DateTimeRangeProps {
  value: RangeValue;
  onChange: (next: RangeValue & { valid: boolean; reason?: string }) => void;
  min?: string;
  required?: boolean;
  disabledDate?: (date: Date) => boolean;
  minuteStep?: number;
  hour12?: boolean;
  size?: "sm" | "md";
  tone?: "warm" | "celestial";
  startLabel?: string;
  endLabel?: string;
}

export function DateTimeRange({
  value,
  onChange,
  min,
  required = false,
  disabledDate,
  minuteStep = 15,
  hour12 = true,
  size = "md",
  tone = "warm",
  startLabel = "Starts",
  endLabel = "Ends",
}: DateTimeRangeProps) {
  const emit = (start: string, end: string) => {
    const v = rangeValidity(start, end, { required });
    onChange({ start, end, valid: v.valid, reason: v.reason });
  };
  const labelTone = tone === "celestial" ? "text-stardust" : "text-muted";

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={`text-sm ${labelTone}`}>{startLabel}</span>
        <DateTimePicker
          value={value.start}
          onChange={(s) => emit(s, reconcileEnd(s, value.end))}
          min={min}
          disabledDate={disabledDate}
          minuteStep={minuteStep}
          hour12={hour12}
          size={size}
          tone={tone}
          required={required}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={`text-sm ${labelTone}`}>{endLabel}</span>
        <DateTimePicker
          value={value.end}
          onChange={(e) => emit(value.start, e)}
          min={value.start || min}
          disabledDate={disabledDate}
          minuteStep={minuteStep}
          hour12={hour12}
          size={size}
          tone={tone}
          required={required}
        />
      </label>
    </div>
  );
}
