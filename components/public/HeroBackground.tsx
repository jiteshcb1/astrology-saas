// Celestial hero background (SP-4.5 redesign) — CSS/SVG only (no canvas/WebGL). Slow-rotating zodiac
// ring + drifting star particles, gated by the consultant's background_style. `tint` is the hero's
// readable text color so the motifs show on any PRIMARY background. prefers-reduced-motion disables
// all animation (see globals.css). Purely decorative → aria-hidden.

const STARS = [
  { t: 14, l: 10, s: 2, d: 0 }, { t: 24, l: 80, s: 3, d: 1.2 }, { t: 42, l: 20, s: 2, d: 0.6 },
  { t: 18, l: 54, s: 2, d: 2.1 }, { t: 62, l: 86, s: 3, d: 0.3 }, { t: 72, l: 32, s: 2, d: 1.7 },
  { t: 36, l: 66, s: 2, d: 0.9 }, { t: 52, l: 8, s: 3, d: 2.4 }, { t: 78, l: 60, s: 2, d: 1.1 },
  { t: 10, l: 90, s: 2, d: 0.5 }, { t: 66, l: 16, s: 2, d: 1.9 }, { t: 30, l: 42, s: 2, d: 1.4 },
  { t: 84, l: 78, s: 3, d: 0.7 }, { t: 46, l: 72, s: 2, d: 2.2 }, { t: 20, l: 34, s: 2, d: 1.0 },
  { t: 74, l: 48, s: 2, d: 0.4 },
];

// Round computed SVG coords to 2dp so server (Node/V8) and client (any JS engine) serialize identically —
// raw Math.cos/Math.sin can differ in the last float digit across engines and trip hydration when this
// backdrop renders inside a Client Component (e.g. /pricing's PricingView).
const q = (n: number) => Math.round(n * 100) / 100;

export function HeroBackground({ style, tint }: { style: string; tint: string }) {
  const showStars = style === "stars" || style === "stars_zodiac";
  const showZodiac = style === "zodiac" || style === "stars_zodiac";
  if (!showStars && !showZodiac) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {showZodiac && (
        <svg
          viewBox="0 0 400 400"
          className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2"
          style={{ color: tint, opacity: 0.16 }}
          fill="none"
          stroke="currentColor"
        >
          <g className="zodiac-ring" strokeWidth="0.6">
            <circle cx="200" cy="200" r="190" />
            <circle cx="200" cy="200" r="150" />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * 30 * Math.PI) / 180;
              return <line key={i} x1={q(200 + 150 * Math.cos(a))} y1={q(200 + 150 * Math.sin(a))} x2={q(200 + 190 * Math.cos(a))} y2={q(200 + 190 * Math.sin(a))} />;
            })}
          </g>
          <g className="zodiac-ring-rev" strokeWidth="0.7">
            <circle cx="200" cy="200" r="120" />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * 30 * Math.PI) / 180;
              return <circle key={i} cx={q(200 + 120 * Math.cos(a))} cy={q(200 + 120 * Math.sin(a))} r="2" fill="currentColor" stroke="none" />;
            })}
          </g>
        </svg>
      )}
      {showStars &&
        STARS.map((s, i) => (
          <span
            key={i}
            className="drift-star absolute rounded-full"
            style={{ top: `${s.t}%`, left: `${s.l}%`, width: s.s, height: s.s, background: tint, opacity: 0.22, boxShadow: `0 0 6px 1px ${tint}`, animationDelay: `${s.d}s` }}
          />
        ))}
    </div>
  );
}
