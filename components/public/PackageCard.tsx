import { readableTextOn } from "@/lib/branding";

const DEFAULT_THEME = "#e8a33d"; // marigold fallback

// Strip consultant rich-text (Quill HTML) to a plain-text excerpt — cards show plain text only
// (rich formatting lives in the About section). Decodes the few common entities Quill emits.
function toPlainText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6])\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Seeker-facing package card — single source of truth for the public profile (SP-4.5) and the
 * consultant's live editor preview. Equal height (flex column, price+CTA pinned to the bottom),
 * plain-text 3-line clamp. `themeColor` is the consultant PRIMARY (price text + Book button).
 */
export function PackageCard({
  title,
  durationLabel,
  priceLabel,
  descriptionHtml = "",
  themeColor,
  ctaLabel = "Book",
  selected,
  onSelect,
}: {
  title: string;
  durationLabel: string;
  priceLabel: string;
  descriptionHtml?: string;
  themeColor?: string | null;
  ctaLabel?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const primary = themeColor || DEFAULT_THEME;
  const onPrimary = readableTextOn(primary);
  const interactive = Boolean(onSelect);
  const text = toPlainText(descriptionHtml);

  return (
    <div
      onClick={onSelect}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(); } } : undefined}
      style={selected ? { borderColor: primary, boxShadow: `0 0 0 2px ${primary}` } : undefined}
      className={`flex h-full flex-col rounded-card border bg-white p-6 shadow-[0_10px_30px_rgba(20,18,43,0.06)] transition ${
        selected ? "" : "border-line"
      } ${interactive ? "cursor-pointer outline-none hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(20,18,43,0.12)] focus-visible:border-marigold" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sand-2/40 px-2.5 py-1 text-xs font-medium text-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3z" strokeLinejoin="round" /></svg>
          Video Meeting
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sand-2/40 px-2.5 py-1 text-xs font-medium text-ink">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {durationLabel}
        </span>
      </div>

      <h3 className="mt-3 break-words font-display text-xl text-ink">{title || "Your package name"}</h3>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
        {text || "A short description of what this session covers will appear here."}
      </p>

      {/* Price bar — amount in ink (always readable); CTA = branded circular arrow */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="font-display text-2xl text-ink">{priceLabel}</span>
        {selected ? (
          <span className="rounded-control px-4 py-2 text-sm font-semibold" style={{ backgroundColor: primary, color: onPrimary }}>Selected ✓</span>
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition" style={{ backgroundColor: primary, color: onPrimary }} aria-label={ctaLabel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        )}
      </div>
    </div>
  );
}
