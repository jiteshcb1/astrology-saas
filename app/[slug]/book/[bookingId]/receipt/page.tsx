import type { Metadata } from "next";
import { getBookingReceipt } from "@/lib/receipt";
import { readableTextOn } from "@/lib/branding";
import { PublicOffline } from "@/components/public/PublicOffline";
import { PrintButton } from "@/components/public/PrintButton";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

const DEFAULT_THEME = "#e8a33d";

function fmtWhen(iso: string | null, tz: string): string {
  if (!iso) return "—";
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const t = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return `${d} · ${t} (${tz})`;
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default async function ReceiptPage({ params }: { params: Promise<{ slug: string; bookingId: string }> }) {
  const { slug, bookingId } = await params;
  const r = await getBookingReceipt(slug, bookingId);
  if (!r) return <PublicOffline />;

  const accent = r.accent || DEFAULT_THEME;
  const onAccent = readableTextOn(accent);
  const initial = (r.consultantName.trim()[0] ?? "A").toUpperCase();
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-medium text-ink">{v}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand px-4 py-8 print:bg-white">
      <div className="mx-auto max-w-md overflow-hidden rounded-card border border-line bg-white shadow-[0_10px_30px_rgba(20,18,43,0.06)] print:border-0 print:shadow-none">
        <header className="flex items-center gap-3 px-6 py-5" style={{ backgroundColor: accent, color: onAccent }}>
          {r.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logoUrl} alt={r.consultantName} className="h-11 w-11 rounded-full bg-white object-cover" />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 font-display text-lg" style={{ color: accent }}>{initial}</span>
          )}
          <div className="min-w-0">
            <div className="font-display text-lg leading-tight">{r.consultantName}</div>
            <div className="text-xs opacity-90">Consultation Receipt</div>
          </div>
        </header>

        <div className="px-6 py-5 text-sm">
          {row("Receipt no.", r.receiptNumber)}
          {row("Issued", fmtDate(r.issuedAtISO))}
          {r.seekerName ? row("Paid by", r.seekerName) : null}
          {row("Session", `${r.packageTitle} · ${r.durationLabel}`)}
          {row("When", fmtWhen(r.startISO, r.timezone))}
          {r.gstNumber ? row("GST", r.gstNumber) : null}
          <div className="mt-3 flex items-baseline justify-between border-t-2 border-line pt-3">
            <span className="text-muted">Total paid</span>
            <span className="font-display text-2xl text-ink">{r.amountLabel}</span>
          </div>
          {r.status !== "confirmed" && (
            <p className="mt-3 rounded-control bg-marigold/10 px-3 py-2 text-xs text-ink">
              Payment is pending verification by {r.consultantName}.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-4 print:hidden">
          <span className="text-xs text-muted">Powered by Astro Consultancy</span>
          <PrintButton label="Print / Save" style={{ backgroundColor: accent, color: onAccent }} />
        </div>
      </div>
    </div>
  );
}
