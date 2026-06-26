"use client";

import { useState, useTransition } from "react";
import { CosmicLoader } from "@/components/ui/CosmicLoader";
import { acceptInviteAction } from "@/app/[slug]/invite/[token]/actions";

export function AcceptInviteButton({ token, accent, onAccent }: { token: string; accent: string; onAccent: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    start(async () => {
      const r = await acceptInviteAction(token);
      if (r?.error) setError(r.error);
      // success path redirects server-side (no return).
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        aria-busy={pending || undefined}
        style={{ backgroundColor: accent, color: onAccent }}
        className="flex w-full items-center justify-center gap-2 rounded-control px-6 py-3 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.15)] transition hover:opacity-95 disabled:opacity-70"
      >
        {pending && <CosmicLoader size="sm" variant="auto" />}
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-terra">{error}</p>}
    </div>
  );
}
