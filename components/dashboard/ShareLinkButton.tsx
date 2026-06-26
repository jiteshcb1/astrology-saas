"use client";

import { useState } from "react";

// Copies the consultant's public booking URL to the clipboard with a brief "Copied!" confirmation.
// Used by empty-state CTAs and the setup checklist (most consultants WhatsApp this link to seekers).
export function ShareLinkButton({ url, label = "Share your booking page", className }: { url: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
      className={className ?? "inline-flex items-center gap-1 rounded-control bg-marigold px-4 py-2 text-sm font-semibold text-night transition hover:-translate-y-0.5"}
    >
      {copied ? "Copied!" : label} {copied ? "✓" : "→"}
    </button>
  );
}
