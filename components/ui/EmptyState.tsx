import type { ReactNode } from "react";

// SP-5.5 empty-state system. Each variant = an on-brand inline SVG + headline + body. The CTA (if any) is
// passed by the caller as `cta` (a Link / client button) since most CTAs need runtime data (slug, panels).
// Legacy props (title/message/icon) still work for older call sites.

export type EmptyVariant =
  | "no_bookings_yet"
  | "no_earnings_yet"
  | "no_team_yet"
  | "no_packages_consultant"
  | "no_packages_public"
  | "no_upcoming_sessions"
  | "no_ratings_yet"
  | "no_receipts_yet"
  | "chart_insufficient_data"
  | "consultant_all_done";

const S = ({ children }: { children: ReactNode }) => (
  <svg width="60" height="60" viewBox="0 0 64 64" fill="none" aria-hidden>
    {children}
  </svg>
);
const star = (cx: number, cy: number, r: number, fill: string, stroke?: string) => {
  const pts = Array.from({ length: 10 }).map((_, i) => {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={stroke ? 2.4 : 0} strokeLinejoin="round" />;
};

const CATALOGUE: Record<EmptyVariant, { illustration: ReactNode; headline: string; body: string }> = {
  no_bookings_yet: {
    illustration: (
      <S>
        <rect x="10" y="16" width="44" height="38" rx="6" fill="#14122b" />
        <path d="M10 26h44" stroke="#f6efe2" strokeOpacity="0.25" strokeWidth="1.5" />
        <path d="M22 11v8M42 11v8" stroke="#14122b" strokeWidth="3" strokeLinecap="round" />
        {star(40, 40, 8, "#e8a33d")}
      </S>
    ),
    headline: "Your calendar is ready.",
    body: "Bookings appear here once seekers find your page and book a session.",
  },
  no_earnings_yet: {
    illustration: (
      <S>
        <text x="32" y="30" textAnchor="middle" fontSize="26" fill="#14122b" fontFamily="Georgia, serif">₹</text>
        <path d="M18 46c6-9 22-9 28 0" stroke="#e8a33d" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M40 39l6 7-8 1" stroke="#e8a33d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </S>
    ),
    headline: "Earnings start with your first confirmed booking.",
    body: "Once a seeker pays and their booking is confirmed, your earnings appear here by month.",
  },
  no_team_yet: {
    illustration: (
      <S>
        <circle cx="26" cy="32" r="16" fill="#14122b" fillOpacity="0.85" />
        <circle cx="38" cy="32" r="16" fill="#e8a33d" fillOpacity="0.6" />
      </S>
    ),
    headline: "It's just you — for now.",
    body: "Invite a consulting partner to share your schedule, or an accounts manager to handle the financial side.",
  },
  no_packages_consultant: {
    illustration: (
      <S>
        <rect x="16" y="30" width="32" height="22" rx="3" fill="#14122b" />
        <path d="M16 39h32M32 30v22" stroke="#f6efe2" strokeOpacity="0.3" strokeWidth="1.5" />
        {star(32, 16, 7, "#e8a33d")}
      </S>
    ),
    headline: "No services published yet.",
    body: "Create your first package so seekers know what you offer and can book a session.",
  },
  no_packages_public: {
    illustration: (
      <S>
        <rect x="16" y="30" width="32" height="22" rx="3" fill="#14122b" />
        <path d="M16 39h32M32 30v22" stroke="#f6efe2" strokeOpacity="0.3" strokeWidth="1.5" />
        {star(32, 16, 7, "#e8a33d")}
      </S>
    ),
    headline: "No services published yet.",
    body: "Check back soon — this consultant is setting up their offerings.",
  },
  no_upcoming_sessions: {
    illustration: (
      <S>
        <path d="M10 46h44" stroke="#14122b" strokeWidth="3" strokeLinecap="round" />
        <path d="M21 46a11 11 0 0 1 22 0z" fill="#e8a33d" />
        <path d="M32 22v-6M15 31l-4-4M49 31l4-4" stroke="#e8a33d" strokeWidth="2.5" strokeLinecap="round" />
      </S>
    ),
    headline: "Nothing scheduled yet.",
    body: "Your confirmed upcoming sessions appear here. Seekers can book on your public page.",
  },
  no_ratings_yet: {
    illustration: <S>{star(32, 31, 17, "none", "#e8a33d")}</S>,
    headline: "Reviews appear after completed sessions.",
    body: "When seekers leave feedback, their ratings show here.",
  },
  no_receipts_yet: {
    illustration: (
      <S>
        <path d="M20 12h24v40l-4-2.6-4 2.6-4-2.6-4 2.6-4-2.6-4 2.6z" fill="#14122b" />
        <path d="M26 23h12M26 29h12" stroke="#f6efe2" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
        <text x="32" y="45" textAnchor="middle" fontSize="12" fill="#e8a33d" fontFamily="Georgia, serif">₹</text>
      </S>
    ),
    headline: "No receipts yet.",
    body: "Confirmed bookings generate receipt records here. They appear once payments are confirmed.",
  },
  chart_insufficient_data: {
    illustration: null, // rendered specially below
    headline: "Not enough data yet.",
    body: "Your chart appears once there's enough history. Come back soon.",
  },
  consultant_all_done: {
    illustration: (
      <svg width="52" height="52" viewBox="0 0 56 56" fill="none" aria-hidden>
        <circle cx="28" cy="28" r="20" fill="#e8a33d" />
        <path d="M19 28l6 6 12-13" stroke="#14122b" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "Your page is fully set up ✓",
    body: "Everything is in place. Your public page is live and ready for seekers to book.",
  },
};

const DefaultIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="M11 8v3M11 14h.01M20 20l-3.5-3.5" strokeLinecap="round" />
  </svg>
);

export function EmptyState({
  variant,
  headline,
  body,
  cta,
  title,
  message,
  icon,
}: {
  variant?: EmptyVariant;
  headline?: string;
  body?: string;
  cta?: ReactNode;
  // Legacy:
  title?: string;
  message?: string;
  icon?: ReactNode;
}) {
  if (variant) {
    const e = CATALOGUE[variant];
    const head = headline ?? e.headline;
    const bod = body ?? e.body;

    if (variant === "chart_insufficient_data") {
      return (
        <div className="relative overflow-hidden rounded-card border border-line bg-white p-4">
          <div aria-hidden className="flex h-32 items-end gap-3 opacity-15">
            {[40, 70, 55, 90, 65, 100].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-marigold" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <p className="font-display text-ink">{head}</p>
            <p className="max-w-xs text-sm text-muted">{bod}</p>
            {cta}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        {e.illustration}
        <p className="mt-1 font-display text-ink">{head}</p>
        <p className="max-w-sm text-sm text-muted">{bod}</p>
        {cta ? <div className="mt-2">{cta}</div> : null}
      </div>
    );
  }

  // Legacy mode.
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="text-muted">{icon ?? DefaultIcon}</div>
      <p className="font-display text-ink">{title}</p>
      {message ? <p className="max-w-sm text-sm text-muted">{message}</p> : null}
    </div>
  );
}
