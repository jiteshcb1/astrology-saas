"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { setEmailSettingAction } from "@/app/superadmin/settings/email-notifications/actions";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function EmailToggleCard({
  settingKey,
  title,
  description,
  warning,
  initialEnabled,
  updatedAtISO,
  locked = false,
}: {
  settingKey: string;
  title: string;
  description: string;
  warning?: string;
  initialEnabled: boolean;
  updatedAtISO: string | null;
  /** Write-locked by the hard code-level global pause: greyed out, can't be toggled here. */
  locked?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    if (locked) return;
    const next = !enabled;
    setErr(null);
    setEnabled(next); // optimistic
    start(async () => {
      const r = await setEmailSettingAction(settingKey, next);
      if (!r.ok) {
        setEnabled(!next); // revert
        setErr(r.error);
      }
    });
  }

  // While locked the live status reflects the global pause (everything is off), not the stored DB value.
  const effectiveOn = !locked && enabled;
  return (
    <Card className={locked ? "opacity-60" : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={effectiveOn}
          aria-label={`${title} ${effectiveOn ? "on" : "off"}`}
          aria-disabled={locked || undefined}
          disabled={pending || locked}
          title={locked ? "Locked — email is globally paused in code" : undefined}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${effectiveOn ? "bg-green" : "bg-line"} ${pending ? "opacity-60" : ""} ${locked ? "cursor-not-allowed" : ""}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${effectiveOn ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={effectiveOn ? "font-medium text-green" : "font-medium text-terra"}>{locked ? "Paused (locked)" : enabled ? "Sending" : "Paused"}</span>
        {updatedAtISO && <span className="text-muted">Updated {fmtDate(updatedAtISO)}</span>}
        {err && <span className="text-terra">{err}</span>}
      </div>

      {!effectiveOn && warning && <p className="mt-2 rounded-control border border-marigold/40 bg-marigold/10 px-3 py-2 text-xs text-ink">{warning}</p>}
    </Card>
  );
}
