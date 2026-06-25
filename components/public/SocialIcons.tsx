import type { ReactNode } from "react";

// Small inline social icons keyed by platform. Renders only links that are present + non-empty.
const ICONS: Record<string, { label: string; icon: ReactNode }> = {
  website: { label: "Website", icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></> },
  instagram: { label: "Instagram", icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></> },
  youtube: { label: "YouTube", icon: <><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" /></> },
  x: { label: "X", icon: <path d="M4 4l16 16M20 4L4 20" /> },
  twitter: { label: "X", icon: <path d="M4 4l16 16M20 4L4 20" /> },
  linkedin: { label: "LinkedIn", icon: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 014 0v4" /></> },
  facebook: { label: "Facebook", icon: <path d="M14 8h2V5h-2a3 3 0 00-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8a1 1 0 011-1z" fill="currentColor" stroke="none" /> },
};

function href(key: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (key === "instagram") return `https://instagram.com/${value.replace(/^@/, "")}`;
  if (key === "youtube") return `https://youtube.com/${value.replace(/^@/, "")}`;
  if (key === "x" || key === "twitter") return `https://x.com/${value.replace(/^@/, "")}`;
  if (key === "linkedin") return `https://linkedin.com/in/${value.replace(/^@/, "")}`;
  if (key === "facebook") return `https://facebook.com/${value.replace(/^@/, "")}`;
  return `https://${value}`;
}

export function SocialIcons({
  links,
  className = "",
  variant = "round",
  tone = "ink",
}: {
  links: Record<string, string>;
  className?: string;
  /** round = compact circle buttons (hero); card = labelled square cards (About section). */
  variant?: "round" | "card";
  /** "ink" for light backgrounds, "ivory" for the dark/colored hero. */
  tone?: "ink" | "ivory";
}) {
  const entries = Object.entries(links).filter(([k, v]) => v && ICONS[k]);
  if (entries.length === 0) return null;

  if (variant === "card") {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        {entries.map(([key, value]) => (
          <a
            key={key}
            href={href(key, value)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex h-20 w-20 flex-col items-center justify-center gap-1.5 rounded-card border border-line bg-white text-ink transition hover:-translate-y-0.5 hover:border-marigold hover:text-marigold"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[key].icon}
            </svg>
            <span className="text-[11px]">{ICONS[key].label}</span>
          </a>
        ))}
      </div>
    );
  }

  const toneCls = tone === "ivory" ? "border-white/30 text-white hover:border-white hover:bg-white/10" : "border-line text-ink hover:border-marigold hover:text-marigold";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {entries.map(([key, value]) => (
        <a
          key={key}
          href={href(key, value)}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={ICONS[key].label}
          className={`grid h-9 w-9 place-items-center rounded-full border transition ${toneCls}`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[key].icon}
          </svg>
        </a>
      ))}
    </div>
  );
}
