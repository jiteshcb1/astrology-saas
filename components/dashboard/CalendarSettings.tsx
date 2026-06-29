"use client";

import { Card } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import type { SafeCalendarView } from "@/lib/calendar";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

function GoogleCalendarIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#fff" stroke="#4285F4" strokeWidth="1.6" />
      <path d="M3 8h18" stroke="#4285F4" strokeWidth="1.6" />
      <path d="M8 3v3M16 3v3" stroke="#4285F4" strokeWidth="1.6" strokeLinecap="round" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="7" fontFamily="Inter, sans-serif" fill="#34A853" fontWeight="700">31</text>
    </svg>
  );
}
function CheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="10" fill="#4f9d69" />
      <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarSettings({
  view,
  tokenOk = true,
  connectHref,
  disconnectAction,
  notice,
}: {
  view: SafeCalendarView | null;
  tokenOk?: boolean;
  connectHref: string;
  disconnectAction: () => Promise<void>;
  notice: { kind: "success" | "error"; text: string } | null;
}) {
  const connected = Boolean(view?.connected);
  const errored = view?.status === "error";
  // Connected in the DB but the token failed to validate → prompt a reconnect inline.
  const unhealthy = connected && !tokenOk;

  return (
    <div className="space-y-4">
      {notice && (
        <p className={`rounded-control px-4 py-3 text-sm text-ink ${notice.kind === "success" ? "border border-green/40 bg-green/10" : "border border-terra/40 bg-terra/10"}`}>
          {notice.text}
        </p>
      )}

      <Card>
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle />
              <h2 className="font-display text-lg text-ink">{view?.googleEmail ? `Connected as ${view.googleEmail}` : "Connected"}</h2>
            </div>
            {unhealthy && (
              <div className="rounded-control border border-terra/40 bg-terra/10 px-3 py-2.5 text-sm text-terra">
                <p className="font-medium">This connection needs attention.</p>
                <p className="mt-0.5 text-xs">We couldn&apos;t verify access to your Google Calendar — Meet links and busy-time blocking may not work. Please reconnect.</p>
                <a href={connectHref} className="mt-2 inline-block rounded-control bg-marigold px-3 py-1.5 text-xs font-semibold text-night transition hover:-translate-y-0.5">Reconnect</a>
              </div>
            )}
            <dl className="space-y-2 text-sm">
              {view?.googleEmail && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Google account</dt>
                  <dd className="text-ink">{view.googleEmail}</dd>
                </div>
              )}
              {view?.connectedAtISO && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Connected on</dt>
                  <dd className="text-ink">{fmtDate(view.connectedAtISO)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Calendar</dt>
                <dd className="text-ink">{view?.calendarId ?? "primary"}</dd>
              </div>
            </dl>
            <p className="rounded-control border border-line bg-sand-2/30 px-3 py-2 text-xs text-muted">
              We only create events for confirmed bookings and check availability. We never read your calendar content.
            </p>
            <ConfirmDeleteButton action={disconnectAction} label="Disconnect" />
          </div>
        ) : errored ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <GoogleCalendarIcon />
              <div>
                <h2 className="font-display text-lg text-ink">Reconnect Google Calendar</h2>
                <p className="mt-1 text-sm text-terra">{view?.lastError ?? "Your Google connection needs attention."}</p>
              </div>
            </div>
            <a
              href={connectHref}
              className="inline-flex items-center gap-2 rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night transition hover:-translate-y-0.5"
            >
              Reconnect Google Calendar
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <GoogleCalendarIcon />
              <div>
                <h2 className="font-display text-lg text-ink">Connect Google Calendar</h2>
                <p className="mt-1 text-sm text-muted">
                  Connecting allows automatic slot blocking when you have other Calendar events, and generates Google Meet links for your sessions.
                </p>
              </div>
            </div>
            <p className="rounded-control border border-line bg-sand-2/30 px-3 py-2 text-xs text-muted">
              <strong className="text-ink">Privacy:</strong> We only create events for confirmed bookings and check availability. We never read your calendar content.
            </p>
            <a
              href={connectHref}
              className="inline-flex items-center gap-2 rounded-control bg-marigold px-4 py-2.5 text-sm font-semibold text-night transition hover:-translate-y-0.5"
            >
              <GoogleCalendarIcon size={18} />
              Connect Google Calendar
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
