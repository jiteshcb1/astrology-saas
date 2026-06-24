"use client";

import { useState, type CSSProperties } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/style.css";
import { dateToISO, formatDateLabel, isoToDate } from "@/lib/datetime";

/**
 * Themed single-date picker — a roomy calendar popover (react-day-picker) with month/year nav,
 * today marker, arrow-key navigation, Esc to close, Enter to select. Value is "YYYY-MM-DD" ("" empty).
 *
 * Props:
 * - value/onChange   controlled "YYYY-MM-DD"
 * - min/max          inclusive "YYYY-MM-DD" bounds (earlier/later days greyed) — pass start's date as
 *                    the end picker's `min` for a linked range
 * - disabledDate     predicate to grey specific days (e.g. fully-booked in SP-4)
 * - weekStartsOn     0=Sun … 6=Sat (default 0)
 * - size             "sm" | "md" (default "md")
 * - clearable, placeholder, disabled, required, id, ariaLabel
 */
export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabledDate?: (date: Date) => boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  size?: "sm" | "md";
  clearable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
}

const sizes = {
  sm: "h-9 px-2.5 text-sm",
  md: "h-10 px-3 text-sm",
};

// Theme react-day-picker to our tokens (marigold selection, terracotta today, comfortable 40px cells).
const calendarVars: CSSProperties = {
  "--rdp-accent-color": "#e8a33d",
  "--rdp-accent-background-color": "#f6efe2",
  "--rdp-today-color": "#b9543a",
  "--rdp-day-width": "40px",
  "--rdp-day-height": "40px",
  "--rdp-day_button-width": "40px",
  "--rdp-day_button-height": "40px",
  "--rdp-day_button-border-radius": "10px",
  "--rdp-font-family": "var(--font-inter, inherit)",
} as CSSProperties;

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabledDate,
  weekStartsOn = 0,
  size = "md",
  clearable = false,
  placeholder = "Select date",
  disabled = false,
  id,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);

  const disabledMatchers: Matcher[] = [];
  const minD = min ? isoToDate(min) : undefined;
  const maxD = max ? isoToDate(max) : undefined;
  if (minD) disabledMatchers.push({ before: minD });
  if (maxD) disabledMatchers.push({ after: maxD });
  if (disabledDate) disabledMatchers.push((d: Date) => disabledDate(d));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? "Select date"}
          className={`inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-control border border-line bg-white text-ink outline-none transition focus:border-marigold focus:ring-2 focus:ring-marigold/40 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${open ? "border-marigold" : ""}`}
        >
          <span className={value ? "" : "text-muted"}>{value ? formatDateLabel(value) : placeholder}</span>
          <span className="flex items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear date"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="text-muted hover:text-terra"
              >
                ✕
              </span>
            )}
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-muted">
              <rect x="3" y="4" width="14" height="13" rx="2" />
              <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
            </svg>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 rounded-card border border-line bg-white p-3 shadow-[0_12px_40px_rgba(20,18,43,0.16)]"
        >
          <div style={calendarVars}>
            <DayPicker
              mode="single"
              autoFocus
              weekStartsOn={weekStartsOn}
              selected={selected}
              defaultMonth={selected}
              disabled={disabledMatchers}
              onSelect={(d) => {
                if (d) {
                  onChange(dateToISO(d));
                  setOpen(false);
                }
              }}
              classNames={{
                today: "text-terra font-semibold",
                caption_label: "font-display text-ink",
                chevron: "fill-marigold",
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
