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
 * - tone             "warm" (dashboard/admin, default) | "celestial" (dark landing/public surfaces)
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
  tone?: "warm" | "celestial";
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

// Theme react-day-picker to our tokens. Warm = marigold/terracotta on white; celestial = marigold on dark.
const baseVars: CSSProperties = {
  "--rdp-day-width": "40px",
  "--rdp-day-height": "40px",
  "--rdp-day_button-width": "40px",
  "--rdp-day_button-height": "40px",
  "--rdp-day_button-border-radius": "10px",
  "--rdp-font-family": "var(--font-inter, inherit)",
} as CSSProperties;
const warmVars: CSSProperties = {
  ...baseVars,
  "--rdp-accent-color": "#e8a33d",
  "--rdp-accent-background-color": "#f6efe2",
  "--rdp-today-color": "#b9543a",
} as CSSProperties;
const celestialVars: CSSProperties = {
  ...baseVars,
  "--rdp-accent-color": "#e8a33d",
  "--rdp-accent-background-color": "#241544",
  "--rdp-today-color": "#f0c074",
} as CSSProperties;

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabledDate,
  weekStartsOn = 0,
  size = "md",
  tone = "warm",
  clearable = false,
  placeholder = "Select date",
  disabled = false,
  id,
  ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);
  const celestial = tone === "celestial";

  const disabledMatchers: Matcher[] = [];
  const minD = min ? isoToDate(min) : undefined;
  const maxD = max ? isoToDate(max) : undefined;
  if (minD) disabledMatchers.push({ before: minD });
  if (maxD) disabledMatchers.push({ after: maxD });
  if (disabledDate) disabledMatchers.push((d: Date) => disabledDate(d));

  // Month+year dropdowns (jump quickly across decades — e.g. a date of birth). Range follows min/max when
  // given, else spans ~100 years back to 10 ahead so a birth year is always reachable.
  const now = new Date();
  const startMonth = minD ?? new Date(now.getFullYear() - 100, 0, 1);
  const endMonth = maxD ?? new Date(now.getFullYear() + 10, 11, 1);

  const triggerTone = celestial
    ? "border-line-cosmos bg-white/[0.06] text-moonstone focus:border-marigold focus:ring-marigold/40"
    : "border-line bg-white text-ink focus:border-marigold focus:ring-marigold/40";
  const mutedText = celestial ? "text-stardust" : "text-muted";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? "Select date"}
          className={`inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-control border outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${triggerTone} ${sizes[size]} ${open ? (celestial ? "border-marigold" : "border-marigold") : ""}`}
        >
          <span className={value ? "" : mutedText}>{value ? formatDateLabel(value) : placeholder}</span>
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
                className={`${mutedText} hover:text-terra`}
              >
                ✕
              </span>
            )}
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className={mutedText}>
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
          className={`z-50 rounded-card border p-3 shadow-[0_12px_40px_rgba(11,16,38,0.5)] ${celestial ? "border-line-cosmos bg-[#16132f]" : "border-line bg-white"}`}
        >
          <div style={celestial ? celestialVars : warmVars} className={celestial ? "text-moonstone" : "text-ink"}>
            <DayPicker
              mode="single"
              autoFocus
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              weekStartsOn={weekStartsOn}
              selected={selected}
              defaultMonth={selected ?? maxD}
              disabled={disabledMatchers}
              onSelect={(d) => {
                if (d) {
                  onChange(dateToISO(d));
                  setOpen(false);
                }
              }}
              classNames={{
                today: celestial ? "text-marigold-soft font-semibold" : "text-terra font-semibold",
                caption_label: celestial ? "font-display text-moonstone" : "font-display text-ink",
                chevron: "fill-marigold",
                dropdowns: "flex items-center gap-1.5",
                dropdown: `cursor-pointer rounded-control px-1.5 py-1 text-sm font-medium outline-none ${celestial ? "bg-[#241544] text-moonstone" : "bg-sand-2/60 text-ink"}`,
              }}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
