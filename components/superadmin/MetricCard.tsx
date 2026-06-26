import type { ReactNode } from "react";
import Link from "next/link";

export function MetricCard({
  label,
  value,
  hint,
  filled,
  accent,
  footer,
  href,
  ariaSuffix,
}: {
  label: string;
  value: string;
  hint?: string;
  filled?: boolean;
  /** Terracotta attention styling (e.g. suspended orgs / pending verification > 0). */
  accent?: boolean;
  /** Optional node under the hint (e.g. a delta badge). Must not change card height when absent. */
  footer?: ReactNode;
  /** SP-5.6: when set, the whole card is a link (hover-lift + pointer). Omit for non-actionable metrics. */
  href?: string;
  /** Extra context appended to the card's aria-label (e.g. "Click to view all consultants"). */
  ariaSuffix?: string;
}) {
  const cls = `block rounded-card border p-5 transition ${
    filled
      ? "border-transparent bg-gradient-to-br from-night to-night-2 text-sand"
      : accent
        ? "border-terra/50 bg-terra/5"
        : "border-line bg-white"
  } ${href ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(20,18,43,0.10)]" : ""}`;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span className={`text-sm ${filled ? "text-sand/70" : "text-muted"}`}>{label}</span>
        <span
          className={`grid h-7 w-7 place-items-center rounded-full ${
            filled ? "bg-sand/15 text-sand" : accent ? "border border-terra/40 text-terra" : "border border-line text-muted"
          }`}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className={`mt-3 font-display text-3xl ${filled ? "text-sand" : "text-ink"}`}>{value}</div>
      {hint ? <div className={`mt-1 text-xs ${filled ? "text-sand/60" : "text-muted"}`}>{hint}</div> : null}
      {footer ? <div className="mt-1">{footer}</div> : null}
    </>
  );

  const ariaLabel = `${label}: ${value}.${hint ? ` ${hint}.` : ""}${ariaSuffix ? ` ${ariaSuffix}.` : ""}`;

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} aria-label={ariaLabel} role="group">
      {inner}
    </div>
  );
}
