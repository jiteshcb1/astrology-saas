"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readableTextOn } from "@/lib/branding";
import { dateToISO, formatTime } from "@/lib/datetime";
import { utcToZonedParts } from "@/lib/timezone";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { PackageCard } from "@/components/public/PackageCard";
import type { PublicPackageView } from "@/lib/public-page";

const DEFAULT_THEME = "#e8a33d"; // marigold

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];
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
function slotLabel(iso: string, tz: string): string {
  const p = utcToZonedParts(new Date(iso), tz);
  return formatTime(`${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`);
}

export interface PublicProfile {
  displayName: string;
  bio: string;
  specialities: string[];
}
export interface PublicBranding {
  themeColor?: string | null;
  logoUrl?: string | null;
}

/**
 * The consultant's public booking page (SP-4.1) — single source of truth, reused by the `/<slug>` route
 * and the dashboard preview. Read-only: select a package → calendar → real slots in the seeker's tz →
 * select a slot. `getSlots` fetches real availability (the route binds it to a server action); when
 * omitted (dashboard preview) the time area shows a placeholder. Confirm/Book is wired in SP-4.2.
 */
export function PublicBookingPage({
  profile,
  branding,
  packages,
  orgName,
  slug,
  timezone = "Asia/Kolkata",
  getSlots,
  onContinue,
}: {
  profile: PublicProfile;
  branding: PublicBranding;
  packages: PublicPackageView[];
  orgName?: string;
  slug?: string;
  timezone?: string;
  getSlots?: (packageId: string, durationMin: number, fromISO: string, toISO: string) => Promise<string[]>;
  /** Real route only: hold the selected slot. Returns the new booking id to navigate to. */
  onContinue?: (packageId: string, durationMin: number, startISO: string) => Promise<{ ok: boolean; bookingId?: string; reason?: string }>;
}) {
  const router = useRouter();
  const accent = branding.themeColor || DEFAULT_THEME;
  const onAccent = readableTextOn(accent);
  const name = profile.displayName || "Your name";
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  const todayISO = dateToISO(new Date());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [date, setDate] = useState("");
  const [tz, setTz] = useState(timezone);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const reqRef = useRef(0);

  async function continueToBook() {
    if (!selectedPkg || !selectedSlot || !onContinue) return;
    setHolding(true);
    setSlotError(null);
    const res = await onContinue(selectedPkg.id, duration, selectedSlot);
    setHolding(false);
    if (res.ok && res.bookingId && slug) {
      router.push(`/${slug}/book/${res.bookingId}`);
    } else if (res.reason === "slot_taken") {
      setSlotError("Someone just booked this time — please choose another.");
      void loadSlots(selectedPkg.id, duration, date);
    } else {
      setSlotError("Couldn't hold this slot. Please try again.");
    }
  }

  const selectedPkg = packages.find((p) => p.id === selectedId) ?? null;

  async function loadSlots(pkgId: string, dur: number, d: string) {
    setSelectedSlot(null);
    if (!getSlots || !d) {
      setSlots([]);
      return;
    }
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

  function selectPackage(p: PublicPackageView) {
    setSelectedId(p.id);
    const dur = p.defaultDurationMin;
    setDuration(dur);
    const d = date || todayISO;
    setDate(d);
    void loadSlots(p.id, dur, d);
  }

  return (
    <div className="min-h-full bg-sand">
      {/* Identity band */}
      <header className="px-6 py-10" style={{ backgroundColor: accent, color: onAccent }}>
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt={name} className="h-16 w-16 shrink-0 rounded-full bg-white object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/90 font-display text-2xl" style={{ color: accent }}>
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight">{name}</h1>
            {orgName && <p className="text-sm opacity-80">{orgName}</p>}
            {profile.bio && <p className="mt-1 max-w-xl text-sm opacity-90">{profile.bio}</p>}
            {profile.specialities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.specialities.map((s) => (
                  <span key={s} className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="mb-4 font-display text-xl text-ink">Book a consultation</h2>
        {packages.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-white/50 px-6 py-8 text-center text-sm text-muted">
            This consultant hasn&apos;t published any sessions yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((p) => (
              <PackageCard
                key={p.id}
                title={p.title}
                durationLabel={p.durationLabel}
                priceLabel={p.priceLabel}
                descriptionHtml={p.descriptionHtml}
                themeColor={accent}
                ctaLabel="Select"
                selected={p.id === selectedId}
                onSelect={() => selectPackage(p)}
              />
            ))}
          </div>
        )}

        {/* Progressive reveal: choose a time after a package is selected */}
        {selectedPkg && (
          <div className="mt-8 rounded-card border border-line bg-white p-6">
            <h3 className="font-display text-lg text-ink">Choose a time</h3>
            <p className="mt-0.5 text-sm text-muted">for {selectedPkg.title}</p>

            {/* Optional duration choice */}
            {selectedPkg.allowBookerChooseDuration && selectedPkg.allowedDurations.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {[...selectedPkg.allowedDurations].sort((a, b) => a - b).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setDuration(d); void loadSlots(selectedPkg.id, d, date); }}
                    className={`rounded-control border px-3 py-1.5 text-sm transition ${duration === d ? "border-marigold bg-marigold/10 text-ink" : "border-line text-muted hover:border-marigold"}`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {/* Calendar */}
              <div>
                <span className="mb-1.5 block text-sm text-muted">Date</span>
                <DatePicker value={date} min={todayISO} onChange={(d) => { setDate(d); void loadSlots(selectedPkg.id, duration, d); }} />
              </div>

              {/* Slots */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">Times</span>
                  <select
                    value={tz}
                    onChange={(e) => setTz(e.target.value)}
                    aria-label="Timezone"
                    className="h-8 rounded-control border border-line bg-white px-2 text-xs text-ink outline-none focus:border-marigold"
                  >
                    {(TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]).map((z) => (
                      <option key={z} value={z}>{tzLabel(z)}</option>
                    ))}
                  </select>
                </div>
                {!getSlots ? (
                  <p className="rounded-control border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Live availability appears here for seekers.</p>
                ) : loading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-control bg-sand-2/60" />)}
                  </div>
                ) : slots.length === 0 ? (
                  <p className="rounded-control border border-line px-3 py-6 text-center text-sm text-muted">No availability on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((iso) => {
                      const sel = iso === selectedSlot;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setSelectedSlot(iso)}
                          style={sel ? { backgroundColor: accent, color: onAccent, borderColor: accent } : undefined}
                          className={`rounded-control border px-2 py-2 text-sm transition ${sel ? "" : "border-line text-ink hover:border-marigold"}`}
                        >
                          {slotLabel(iso, tz)}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">Times in {tz}</p>
              </div>
            </div>

            {/* Continue CTA — real route only */}
            {onContinue && (
              <div className="mt-5 border-t border-line pt-4">
                {slotError && <p className="mb-2 text-sm text-terra">{slotError}</p>}
                <Button
                  type="button"
                  disabled={!selectedSlot || holding}
                  onClick={continueToBook}
                  className="w-full"
                  style={selectedSlot && !holding ? { backgroundColor: accent, color: onAccent } : undefined}
                >
                  {holding ? "Holding…" : selectedSlot ? `Continue · ${slotLabel(selectedSlot, tz)}` : "Select a time to continue"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
