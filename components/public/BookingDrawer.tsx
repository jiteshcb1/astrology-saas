"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { dateToISO, formatTime } from "@/lib/datetime";
import { utcToZonedParts } from "@/lib/timezone";
import type { PublicPackageView } from "@/lib/public-page";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

// The next N selectable days as friendly pills (Topmate-style). Computed once at render (new Date is fine).
function nextDays(n: number): { iso: string; wd: string; dm: string }[] {
  const wdFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
  const dmFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { iso: dateToISO(d), wd: wdFmt.format(d), dm: dmFmt.format(d) };
  });
}
function tzLabel(tz: string): string {
  if (tz === "UTC") return "UTC (UTC+00:00)";
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz} (${name.replace("GMT", "UTC")})`;
  } catch {
    return tz;
  }
}
function slotLabel(iso: string, tz: string): string {
  const p = utcToZonedParts(new Date(iso), tz);
  return formatTime(`${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`);
}

export function BookingDrawer({
  open,
  onClose,
  pkg,
  slug,
  timezone = "Asia/Kolkata",
  accent,
  onAccent,
  getSlots,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  pkg: PublicPackageView | null;
  slug?: string;
  timezone?: string;
  accent: string;
  onAccent: string;
  getSlots?: (packageId: string, durationMin: number, fromISO: string, toISO: string) => Promise<string[]>;
  onContinue?: (packageId: string, durationMin: number, startISO: string) => Promise<{ ok: boolean; bookingId?: string; reason?: string }>;
}) {
  const router = useRouter();
  const todayISO = dateToISO(new Date());
  const dayPills = nextDays(14);

  const [duration, setDuration] = useState(0);
  const [date, setDate] = useState("");
  const [tz, setTz] = useState(timezone);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const reqRef = useRef(0);

  function resetFor(p: PublicPackageView) {
    const dur = p.defaultDurationMin;
    setDuration(dur);
    setDate(todayISO);
    setSelectedSlot(null);
    setSlotError(null);
    void load(p.id, dur, todayISO);
  }

  // (Re)initialize whenever the drawer opens for a package (reset-on-open is intentional).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && pkg) resetFor(pkg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pkg?.id]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function load(pkgId: string, dur: number, d: string) {
    setSelectedSlot(null);
    if (!getSlots || !d) { setSlots([]); return; }
    const reqId = ++reqRef.current;
    setLoading(true);
    try {
      const iso = await getSlots(pkgId, dur, d, d);
      if (reqId !== reqRef.current) return;
      setSlots(iso);
    } catch {
      if (reqId === reqRef.current) setSlots([]);
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }

  async function continueToBook() {
    if (!pkg || !selectedSlot || !onContinue) return;
    setHolding(true);
    setSlotError(null);
    const res = await onContinue(pkg.id, duration, selectedSlot);
    setHolding(false);
    if (res.ok && res.bookingId && slug) {
      router.push(`/${slug}/book/${res.bookingId}`);
    } else if (res.reason === "slot_taken") {
      setSlotError("Someone just booked this time — please choose another.");
      void load(pkg.id, duration, date);
    } else {
      setSlotError("Couldn't hold this slot. Please try again.");
    }
  }

  return (
    <>
      <div onClick={onClose} aria-hidden className={`fixed inset-0 z-40 bg-night/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-ink">Book a session</h2>
            {pkg && <p className="truncate text-sm text-muted">{pkg.title} · {pkg.priceLabel}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-muted hover:bg-sand-2/60">✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
          {!pkg ? null : (
            <>
              {pkg.allowBookerChooseDuration && pkg.allowedDurations.length > 1 && (
                <div>
                  <span className="mb-1.5 block text-sm text-muted">Duration</span>
                  <div className="flex flex-wrap gap-2">
                    {[...pkg.allowedDurations].sort((a, b) => a - b).map((d) => (
                      <button key={d} type="button" onClick={() => { setDuration(d); void load(pkg.id, d, date); }}
                        className={`rounded-control border px-3 py-1.5 text-sm transition ${duration === d ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"}`}>
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="mb-1.5 block text-sm text-muted">When should we meet?</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dayPills.map((dp) => {
                    const sel = dp.iso === date;
                    return (
                      <button key={dp.iso} type="button" onClick={() => { setDate(dp.iso); void load(pkg.id, duration, dp.iso); }}
                        style={sel ? { borderColor: accent, backgroundColor: `${accent}1a` } : undefined}
                        className={`flex shrink-0 flex-col items-center rounded-control border px-3.5 py-2 text-center transition ${sel ? "text-ink" : "border-line text-muted hover:border-marigold"}`}>
                        <span className="text-xs">{dp.wd}</span>
                        <span className="text-sm font-medium text-ink">{dp.dm}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">Select time of day</span>
                  <select value={tz} onChange={(e) => setTz(e.target.value)} aria-label="Timezone" className="h-8 rounded-control border border-line bg-white px-2 text-xs text-ink outline-none focus:border-marigold">
                    {(TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]).map((z) => <option key={z} value={z}>{tzLabel(z)}</option>)}
                  </select>
                </div>
                {!getSlots ? (
                  <p className="rounded-control border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Live availability appears here for seekers.</p>
                ) : loading ? (
                  <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-control bg-sand-2/60" />)}</div>
                ) : slots.length === 0 ? (
                  <p className="rounded-control border border-line px-3 py-6 text-center text-sm text-muted">No availability on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((iso) => {
                      const sel = iso === selectedSlot;
                      return (
                        <button key={iso} type="button" onClick={() => setSelectedSlot(iso)} style={sel ? { backgroundColor: accent, color: onAccent, borderColor: accent } : undefined}
                          className={`rounded-control border px-2 py-2 text-sm transition ${sel ? "" : "border-line text-ink hover:border-marigold"}`}>
                          {slotLabel(iso, tz)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">Times in {tz}</p>
              </div>
            </>
          )}
        </div>

        {onContinue && pkg && (
          <div className="border-t border-line p-5">
            {slotError && <p className="mb-2 text-sm text-terra">{slotError}</p>}
            <Button type="button" disabled={!selectedSlot || holding} onClick={continueToBook} className="w-full" style={selectedSlot && !holding ? { backgroundColor: accent, color: onAccent } : undefined}>
              {holding ? "Holding…" : selectedSlot ? `Continue · ${slotLabel(selectedSlot, tz)}` : "Select a time to continue"}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
