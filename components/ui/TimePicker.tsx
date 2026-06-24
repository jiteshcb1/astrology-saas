"use client";

import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { formatTime, timeOptions } from "@/lib/datetime";

/**
 * Themed time picker — a popover list of stepped times (Calendly-style), so min/max bounds and a
 * `disabledTime` predicate can simply grey out options. Value is a 24h "HH:mm" string ("" when empty).
 *
 * Props:
 * - value/onChange  controlled "HH:mm" ("" = unset)
 * - min/max         inclusive "HH:mm" bounds (out-of-range options are removed) — pass start as the
 *                   end picker's `min` for a linked range
 * - disabledTime    predicate to grey specific times (e.g. already-booked)
 * - minuteStep      option granularity (default 15, matches the scheduling engine)
 * - hour12          12h labels with AM/PM (default true) vs 24h
 * - size            "sm" | "md" (default "md")
 * - clearable, placeholder, disabled, required, id, ariaLabel
 */
export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabledTime?: (time: string) => boolean;
  minuteStep?: number;
  hour12?: boolean;
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

export function TimePicker({
  value,
  onChange,
  min,
  max,
  disabledTime,
  minuteStep = 15,
  hour12 = true,
  size = "md",
  clearable = false,
  placeholder = "Select time",
  disabled = false,
  id,
  ariaLabel,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const options = timeOptions(minuteStep, { min, max });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? "Select time"}
          className={`inline-flex min-w-[8.5rem] items-center justify-between gap-2 rounded-control border border-line bg-white text-ink outline-none transition focus:border-marigold focus:ring-2 focus:ring-marigold/40 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${open ? "border-marigold" : ""}`}
        >
          <span className={value ? "" : "text-muted"}>{value ? formatTime(value, hour12) : placeholder}</span>
          <span className="flex items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear time"
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
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 max-h-64 w-40 overflow-auto rounded-card border border-line bg-white p-1 shadow-[0_12px_40px_rgba(20,18,43,0.16)]"
        >
          <TimeList
            options={options}
            value={value}
            hour12={hour12}
            disabledTime={disabledTime}
            onPick={(t) => {
              onChange(t);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TimeList({
  options,
  value,
  hour12,
  disabledTime,
  onPick,
}: {
  options: string[];
  value: string;
  hour12: boolean;
  disabledTime?: (time: string) => boolean;
  onPick: (time: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (options.length === 0) {
    return <p className="px-3 py-4 text-center text-xs text-muted">No times available.</p>;
  }
  return (
    <>
      {options.map((t) => {
        const isSelected = t === value;
        const isDisabled = disabledTime?.(t) ?? false;
        return (
          <button
            key={t}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            disabled={isDisabled}
            onClick={() => onPick(t)}
            className={`block w-full rounded-control px-3 py-1.5 text-left text-sm transition ${
              isSelected ? "bg-marigold font-medium text-night" : "text-ink hover:bg-sand-2/60"
            } ${isDisabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
          >
            {formatTime(t, hour12)}
          </button>
        );
      })}
    </>
  );
}
