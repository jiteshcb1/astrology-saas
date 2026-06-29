"use client";

import { useState } from "react";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import { joinDateTime, splitDateTime } from "@/lib/datetime";

/**
 * Themed date + time picker for a full local timestamp. Value is "YYYY-MM-DDTHH:mm" ("" until both
 * the date and time are set). Holds the partial date/time internally so picking one doesn't wipe the
 * other; emits the joined value only when complete.
 *
 * Props:
 * - value/onChange   controlled "YYYY-MM-DDTHH:mm"
 * - min/max          inclusive "YYYY-MM-DDTHH:mm" bounds. The date side greys days outside [min,max];
 *                    on a boundary day the time side greys times outside the bound (pass start as the
 *                    end picker's `min` for a linked range)
 * - disabledDate     predicate to grey specific days
 * - minuteStep (15), hour12 (true), size, clearable, required
 */
export interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabledDate?: (date: Date) => boolean;
  minuteStep?: number;
  hour12?: boolean;
  size?: "sm" | "md";
  tone?: "warm" | "celestial";
  clearable?: boolean;
  required?: boolean;
  datePlaceholder?: string;
  timePlaceholder?: string;
}

export function DateTimePicker({
  value,
  onChange,
  min,
  max,
  disabledDate,
  minuteStep = 15,
  hour12 = true,
  size = "md",
  tone = "warm",
  clearable = false,
  required = false,
  datePlaceholder,
  timePlaceholder,
}: DateTimePickerProps) {
  // Keep partial parts so choosing a date before a time (or vice versa) isn't lost.
  const [parts, setParts] = useState(() => splitDateTime(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) setParts(splitDateTime(value));
  }
  const { date, time } = parts;

  const minSplit = min ? splitDateTime(min) : undefined;
  const maxSplit = max ? splitDateTime(max) : undefined;
  const timeMin = minSplit && date && date === minSplit.date ? minSplit.time : undefined;
  const timeMax = maxSplit && date && date === maxSplit.date ? maxSplit.time : undefined;

  const setDate = (d: string) => {
    setParts((p) => ({ ...p, date: d }));
    onChange(joinDateTime(d, time));
  };
  const setTime = (t: string) => {
    setParts((p) => ({ ...p, time: t }));
    onChange(joinDateTime(date, t));
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <DatePicker
        value={date}
        onChange={setDate}
        min={minSplit?.date}
        max={maxSplit?.date}
        disabledDate={disabledDate}
        size={size}
        tone={tone}
        clearable={clearable}
        required={required}
        placeholder={datePlaceholder}
      />
      <TimePicker
        value={time}
        onChange={setTime}
        min={timeMin}
        max={timeMax}
        minuteStep={minuteStep}
        hour12={hour12}
        size={size}
        tone={tone}
        clearable={clearable}
        required={required}
        placeholder={timePlaceholder}
      />
    </div>
  );
}
