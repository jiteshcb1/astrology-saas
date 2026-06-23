import { formatMoney } from "@/lib/money";
import type { CheckoutSummaryData } from "@/lib/checkout";

// Presentational only (no hooks) so it can be reused server-side in the SP-4 invite email too.
export function CheckoutSummary({ summary }: { summary: CheckoutSummaryData | null }) {
  if (!summary) {
    return (
      <div className="rounded-card border border-line bg-white p-5 text-sm text-muted">
        Select a plan to see the charge summary.
      </div>
    );
  }

  const m = (paise: number) => formatMoney(paise, summary.currency);

  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="font-display text-lg text-ink">{summary.planName}</div>
      <div className="text-xs text-muted">Billed {summary.interval}</div>

      <div className="mt-4 text-sm font-medium text-ink">Included</div>
      <ul className="mt-1 space-y-1 text-sm text-muted">
        <li>
          {summary.includedSeats} seat{summary.includedSeats === 1 ? "" : "s"} included
        </li>
        {summary.features.length > 0 ? (
          summary.features.map((f) => <li key={f}>✓ {f}</li>)
        ) : (
          <li>No additional features</li>
        )}
      </ul>

      <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Base plan</span>
          <span className="text-ink">{m(summary.basePaise)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">
            Additional seats ({summary.additionalSeats} × {m(summary.perSeatPaise)})
          </span>
          <span className="text-ink">{m(summary.additionalPaise)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-control bg-marigold/15 px-3 py-3">
        <span className="font-medium text-ink">Total / {summary.interval}</span>
        <span className="font-display text-xl text-ink">{m(summary.totalPaise)}</span>
      </div>

      {/* TODO(SP-4): reuse buildCheckoutSummary() to render this same breakdown in the invite email. */}
    </div>
  );
}
