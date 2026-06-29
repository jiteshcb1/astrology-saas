"use client";

import { useState } from "react";

// Precise time-of-day entry as three intuitive selects — Hour (1–12), Minute (00–59), AM/PM — for things
// like an exact time of birth. Emits/stores a canonical 24-hour "HH:mm" string ("" until all three are set).
// (Distinct from the scheduling TimePicker, which is a stepped slot list for availability/appointments.)

function parse(v: string): { h12: string; m: string; ap: "" | "AM" | "PM" } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(v ?? "");
  if (!match) return { h12: "", m: "", ap: "" };
  let h = parseInt(match[1], 10);
  const ap: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { h12: String(h), m: match[2], ap };
}
function compose(h12: string, m: string, ap: string): string {
  if (!h12 || m === "" || !ap) return ""; // incomplete → no value yet
  let h = parseInt(h12, 10) % 12;
  if (ap === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m.padStart(2, "0")}`;
}

export interface TimeSelectProps {
  value: string; // canonical 24h "HH:mm"
  onChange: (value: string) => void;
  tone?: "warm" | "celestial";
  id?: string;
  ariaLabel?: string;
}

export function TimeSelect({ value, onChange, tone = "warm", id, ariaLabel }: TimeSelectProps) {
  const init = parse(value);
  const [h12, setH] = useState(init.h12);
  const [m, setM] = useState(init.m);
  const [ap, setAp] = useState<string>(init.ap);
  // Adjust internal parts when the controlled value changes externally (e.g. reset). React-sanctioned
  // "derive state from props" pattern — not an effect.
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    const p = parse(value);
    setH(p.h12);
    setM(p.m);
    setAp(p.ap);
  }

  const emit = (nh: string, nm: string, na: string) => {
    setH(nh);
    setM(nm);
    setAp(na);
    onChange(compose(nh, nm, na));
  };

  const celestial = tone === "celestial";
  const sel = `h-10 cursor-pointer rounded-control border px-2 text-sm outline-none transition focus:ring-2 ${
    celestial
      ? "border-line-cosmos bg-white/[0.06] text-moonstone focus:border-marigold focus:ring-marigold/40"
      : "border-line bg-white text-ink focus:border-marigold focus:ring-marigold/40"
  }`;

  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label={ariaLabel ?? "Time"}>
      <select id={id} aria-label="Hour" value={h12} onChange={(e) => emit(e.target.value, m, ap)} className={sel}>
        <option value="">HH</option>
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className={celestial ? "text-stardust" : "text-muted"}>:</span>
      <select aria-label="Minute" value={m} onChange={(e) => emit(h12, e.target.value, ap)} className={sel}>
        <option value="">MM</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select aria-label="AM or PM" value={ap} onChange={(e) => emit(h12, m, e.target.value)} className={sel}>
        <option value="">AM/PM</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
