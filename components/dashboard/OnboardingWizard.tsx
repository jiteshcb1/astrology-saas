"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ReadOnlyField } from "@/components/ui/ReadOnlyField";
import type { ProfileFormState } from "@/lib/consultant-profile";
import { completeOnboardingAction } from "@/app/onboarding/actions";

const BUSINESS_TYPES = [
  "Astrologer",
  "Vedic Astrologer",
  "Tarot Reader",
  "Numerologist",
  "Vastu Consultant",
  "Other",
];

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function CurrentTime({ timezone }: { timezone: string }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => {
      try {
        setNow(new Intl.DateTimeFormat("en-IN", { timeZone: timezone, hour: "2-digit", minute: "2-digit", weekday: "short" }).format(new Date()));
      } catch {
        setNow("");
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);
  return now ? <span className="text-xs text-muted">Current time: {now}</span> : null;
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${active || done ? "bg-marigold text-night" : "bg-line text-muted"}`}>
        {n}
      </span>
      <span className={active ? "text-ink" : "text-muted"}>{label}</span>
    </span>
  );
}

export function OnboardingWizard({
  bookingBase,
  slug,
  defaults,
  calendarConnected = false,
  calendarEmail,
}: {
  bookingBase: string;
  slug: string;
  defaults?: { displayName?: string; businessType?: string; timezone?: string };
  calendarConnected?: boolean;
  calendarEmail?: string | null;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(completeOnboardingAction, {});
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(defaults?.displayName ?? "");
  const [businessType, setBusinessType] = useState(defaults?.businessType ?? BUSINESS_TYPES[0]);
  const [timezone, setTimezone] = useState(defaults?.timezone ?? "Asia/Kolkata");

  return (
    <form action={formAction}>
      <ol className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <StepDot n={1} label="Profile" active={step === 1} done={step > 1} />
        <span className="h-px w-6 bg-line" />
        <StepDot n={2} label="Calendar" active={step === 2} done={step > 2} />
        <span className="h-px w-6 bg-line" />
        <StepDot n={3} label="Confirm" active={step === 3} done={false} />
      </ol>

      {/* Step 1 — Profile */}
      <div className={step === 1 ? "space-y-3" : "hidden"}>
        <Input name="displayName" label="Display name" placeholder="Pandit Ravi Sharma" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        <Select name="businessType" label="Business type" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
          {BUSINESS_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <div>
          <Select name="timezone" label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <div className="mt-1">
            <CurrentTime timezone={timezone} />
          </div>
        </div>
        <ReadOnlyField label="Your booking URL">
          {bookingBase}/<span className="text-ink">{slug}</span>
        </ReadOnlyField>
        <div className="flex justify-end pt-1">
          <Button type="button" disabled={!displayName.trim()} onClick={() => setStep(2)}>
            Next
          </Button>
        </div>
      </div>

      {/* Step 2 — Calendar (connect later) */}
      <div className={step === 2 ? "space-y-3" : "hidden"}>
        <div className="rounded-card border border-line bg-sand-2/30 p-5">
          <h3 className="font-display text-lg text-ink">Connect Google Calendar</h3>
          {calendarConnected ? (
            <>
              <p className="mt-1 text-sm font-medium text-green">✓ Connected{calendarEmail ? ` as ${calendarEmail}` : ""}.</p>
              <p className="mt-1 text-sm text-muted">We&apos;ll block busy times and add Google Meet links automatically.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Auto-create Meet links and block busy times. You can connect this any time from Settings.
              </p>
              {/* Full navigation to the OAuth-init API route (sets a CSRF cookie + 302s to Google) — not a page. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/calendar/start?return=onboarding"
                className="mt-3 inline-flex items-center gap-2 rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night transition hover:-translate-y-0.5"
              >
                Connect Google Calendar
              </a>
            </>
          )}
        </div>
        <div className="flex justify-between pt-1">
          <Button type="button" variant="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button type="button" onClick={() => setStep(3)}>
            {calendarConnected ? "Continue" : "I'll connect later"}
          </Button>
        </div>
      </div>

      {/* Step 3 — Confirm */}
      <div className={step === 3 ? "space-y-3" : "hidden"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Display name">{displayName || "—"}</ReadOnlyField>
          <ReadOnlyField label="Business type">{businessType}</ReadOnlyField>
          <ReadOnlyField label="Timezone">{timezone}</ReadOnlyField>
          <ReadOnlyField label="Booking URL">
            {bookingBase}/{slug}
          </ReadOnlyField>
        </div>
        {state.error && <p className="text-sm text-terra">{state.error}</p>}
        <div className="flex justify-between pt-1">
          <Button type="button" variant="ghost" onClick={() => setStep(2)}>
            Back
          </Button>
          <Button type="submit" loading={pending} loadingLabel="Finishing…">
            Finish setup
          </Button>
        </div>
      </div>
    </form>
  );
}
