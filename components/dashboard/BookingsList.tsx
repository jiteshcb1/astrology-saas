"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatStamp } from "@/lib/datetime";
import { verifyBookingAction, getProofUrlAction, generateMeetLinkAction } from "@/app/dashboard/bookings/actions";

const MEET_REASON: Record<string, string> = {
  no_calendar: "Connect Google Calendar first.",
  not_confirmed: "Confirm the booking first.",
  no_host: "No host assigned.",
  failed: "Couldn't generate — try reconnecting your calendar.",
};

// Confirmed booking with no Meet link yet → let the consultant generate one on demand (calls the idempotent
// ensureMeetLink). Covers bookings confirmed before the calendar was connected.
function MeetLinkButton({ bookingId, link }: { bookingId: string; link: string | null }) {
  const [current, setCurrent] = useState<string | null>(link);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (current) {
    return <a href={current} target="_blank" rel="noreferrer" className="rounded-control border border-line px-3 py-1.5 text-xs font-medium text-terra transition hover:border-marigold">Meet link →</a>;
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true); setMsg(null);
          const res = await generateMeetLinkAction(bookingId);
          setLoading(false);
          if (res.ok && res.meetLink) setCurrent(res.meetLink);
          else setMsg(MEET_REASON[res.reason ?? "failed"] ?? MEET_REASON.failed);
        }}
        className="rounded-control border border-line px-3 py-1.5 text-xs text-ink transition hover:border-marigold disabled:opacity-50"
      >
        {loading ? "…" : "Generate meeting link"}
      </button>
      {msg && <span className="text-right text-xs text-terra">{msg}</span>}
    </div>
  );
}

export interface BookingRow {
  id: string;
  status: string;
  packageTitle: string;
  seekerName: string;
  seekerEmail: string;
  seekerPhone: string;
  startISO: string | null;
  priceLabel: string;
  paymentMode: string | null;
  utr: string | null;
  hasProof: boolean;
  meetLink: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_verification: "Awaiting verification",
  confirmed: "Confirmed",
  pending_payment: "Awaiting payment",
  cancelled: "Cancelled",
};
function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "confirmed") return "success";
  if (status === "pending_verification") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}
function fmt(iso: string | null): string {
  return iso ? formatStamp(iso) : "—";
}

export function BookingsList({ rows }: { rows: BookingRow[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pending verification first, then by date.
  const sorted = [...rows].sort((a, b) => {
    const pa = a.status === "pending_verification" ? 0 : 1;
    const pb = b.status === "pending_verification" ? 0 : 1;
    return pa - pb;
  });

  async function act(id: string, decision: "confirm" | "reject") {
    setBusyId(id);
    setError(null);
    const res = await verifyBookingAction(id, decision);
    setBusyId(null);
    if (!res.ok) setError(res.error);
  }

  async function viewProof(id: string) {
    const url = await getProofUrlAction(id);
    if (url) window.open(url, "_blank", "noopener");
    else setError("No proof was uploaded for this booking.");
  }

  if (rows.length === 0) {
    return <EmptyState title="No bookings yet" message="When seekers book and pay, they'll show up here for you to verify and manage." />;
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      {error && <p className="border-b border-line bg-terra/10 px-4 py-2 text-sm text-terra">{error}</p>}
      <table className="w-full text-sm">
        <thead className="bg-sand-2/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Seeker</th>
            <th className="px-4 py-3 font-medium">Session</th>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-line hover:bg-sand-2/30">
              <td className="px-4 py-3">
                <div className="font-medium text-ink">{r.seekerName}</div>
                <div className="text-xs text-muted">{r.seekerEmail}</div>
                {r.seekerPhone && <div className="text-xs text-muted">{r.seekerPhone}</div>}
              </td>
              <td className="px-4 py-3 text-ink">{r.packageTitle}</td>
              <td className="px-4 py-3 text-ink">{fmt(r.startISO)}</td>
              <td className="px-4 py-3 text-ink">
                {r.priceLabel}
                <span className="block text-xs text-muted">{r.paymentMode === "upi_qr" ? "UPI proof" : r.paymentMode === "gateway" ? "Gateway" : "—"}</span>
              </td>
              <td className="px-4 py-3"><StatusChip tone={tone(r.status)} label={STATUS_LABEL[r.status] ?? r.status} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {r.hasProof && (
                    <button type="button" onClick={() => viewProof(r.id)} className="rounded-control border border-line px-3 py-1.5 text-xs text-ink transition hover:border-marigold">
                      View proof{r.utr ? ` · UTR ${r.utr}` : ""}
                    </button>
                  )}
                  {r.status === "pending_verification" && (
                    <>
                      <Button type="button" className="h-8 py-0 text-xs" disabled={busyId === r.id} onClick={() => act(r.id, "confirm")}>
                        {busyId === r.id ? "…" : "Confirm"}
                      </Button>
                      <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, "reject")} className="rounded-control border border-line px-3 py-1.5 text-xs text-terra transition hover:border-terra disabled:opacity-50">
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "confirmed" && <MeetLinkButton bookingId={r.id} link={r.meetLink} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
