import { readableTextOn } from "@/lib/branding";

// Shared styling for consultant-authored rich-text (Tiptap HTML), used by both the editor preview and
// the public booking page so they render identically. Tailwind child selectors (no typography plugin).
export const richTextClassName =
  "text-sm leading-relaxed text-ink break-words [&_p]:my-1.5 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_a]:text-terra [&_a]:underline [&_a]:break-all";

const DEFAULT_THEME = "#e8a33d"; // marigold

function isEmptyHtml(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").trim().length === 0;
}

/**
 * Seeker-facing package card — the single source of truth for how a package looks on the public
 * booking page (SP-4.1) and in the consultant's live editor preview. Presentational only.
 *
 * Props: title, durationLabel, priceLabel, descriptionHtml (consultant rich text), themeColor
 * (consultant brand accent; defaults to marigold), ctaLabel.
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
  /** When provided, the whole card is selectable (public booking flow). */
  selected?: boolean;
  onSelect?: () => void;
}) {
  const accent = themeColor || DEFAULT_THEME;
  const onAccent = readableTextOn(accent);
  const interactive = Boolean(onSelect);

  return (
    <div
      onClick={onSelect}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(); } } : undefined}
      style={selected ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}
      className={`rounded-card border bg-white p-6 shadow-[0_10px_30px_rgba(20,18,43,0.06)] transition ${
        selected ? "" : "border-line"
      } ${interactive ? "cursor-pointer outline-none hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(20,18,43,0.1)] focus-visible:border-marigold" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sand-2/70 px-2.5 py-0.5 text-xs text-ink">{durationLabel}</span>
        <span className="rounded-full bg-sand-2/70 px-2.5 py-0.5 text-xs text-ink">Google Meet</span>
      </div>

      <h3 className="mt-3 break-words font-display text-xl text-ink">{title || "Your package name"}</h3>

      {!isEmptyHtml(descriptionHtml) ? (
        <div className={`mt-2 ${richTextClassName}`} dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      ) : (
        <p className="mt-2 text-sm text-muted">A short description of what this session covers will appear here.</p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="font-display text-2xl text-ink">{priceLabel}</span>
        <span
          className="rounded-control px-5 py-2.5 text-sm font-semibold"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          {selected ? "Selected ✓" : ctaLabel}
        </span>
      </div>
    </div>
  );
}
