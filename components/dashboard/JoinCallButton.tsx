"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { joinCallState } from "@/lib/join-call";

// SP-5.6 — "Join call" flips on live (checks every 30s) once a session is within 15 minutes of its start and
// has a meeting link. No link → "Prepare" (booking detail). Before the window → "Join opens in N min".
export function JoinCallButton({
  startISO,
  endISO,
  meetLink,
  accent = "#e8a33d",
  onAccent = "#14122b",
}: {
  startISO: string | null;
  endISO?: string | null;
  meetLink: string | null;
  accent?: string;
  onAccent?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const state = joinCallState(now, startISO ? new Date(startISO).getTime() : null, endISO ? new Date(endISO).getTime() : null, Boolean(meetLink));

  if (state.kind === "prepare") {
    return (
      <Link href="/dashboard/bookings" className="shrink-0 rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-marigold">
        Prepare
      </Link>
    );
  }
  if (state.kind === "pending") {
    // Pre-mount: we don't know the clock yet — neutral hint avoids a hydration flash.
    return <span className="shrink-0 text-xs text-muted">Join opens 15 min before</span>;
  }
  if (state.kind === "join") {
    return (
      <a
        href={meetLink!}
        target="_blank"
        rel="noreferrer"
        style={{ backgroundColor: accent, color: onAccent }}
        className="shrink-0 rounded-control px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
      >
        Join call
      </a>
    );
  }
  return <span className="shrink-0 text-xs text-muted">Join opens in {state.mins} min</span>;
}
