"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { setEmailCategoryAction } from "@/app/superadmin/settings/actions";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function EmailToggleCard({
  category,
  title,
  description,
  warning,
  initialEnabled,
  updatedAtISO,
}: {
  category: "otp" | "transactional";
  title: string;
  description: string;
  warning?: string;
  initialEnabled: boolean;
  updatedAtISO: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !enabled;
    setErr(null);
    setEnabled(next); // optimistic
    start(async () => {
      const r = await setEmailCategoryAction(category, next);
      if (!r.ok) {
        setEnabled(!next); // revert
        setErr(r.error);
      }
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${title} ${enabled ? "on" : "off"}`}
          disabled={pending}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${enabled ? "bg-green" : "bg-line"} ${pending ? "opacity-60" : ""}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={enabled ? "font-medium text-green" : "font-medium text-terra"}>{enabled ? "Sending" : "Paused"}</span>
        {updatedAtISO && <span className="text-muted">Updated {fmtDate(updatedAtISO)}</span>}
        {err && <span className="text-terra">{err}</span>}
      </div>

      {!enabled && warning && <p className="mt-2 rounded-control border border-marigold/40 bg-marigold/10 px-3 py-2 text-xs text-ink">{warning}</p>}
    </Card>
  );
}
