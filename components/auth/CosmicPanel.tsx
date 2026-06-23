// Immersive indigo cosmic panel for the auth split-screen. Presentational only.
// Elegant Indic-mystical night sky in our palette (night + marigold), not literal sci-fi art.

// Deterministic starfield (percent positions) so SSR/CSR match.
const STARS: { t: number; l: number; s: number; o: number }[] = [
  { t: 8, l: 12, s: 2, o: 0.7 }, { t: 14, l: 78, s: 1.5, o: 0.5 }, { t: 20, l: 34, s: 1, o: 0.4 },
  { t: 11, l: 56, s: 2.5, o: 0.8 }, { t: 26, l: 88, s: 1.5, o: 0.6 }, { t: 32, l: 18, s: 1, o: 0.4 },
  { t: 38, l: 64, s: 2, o: 0.7 }, { t: 44, l: 42, s: 1, o: 0.35 }, { t: 50, l: 84, s: 1.5, o: 0.5 },
  { t: 55, l: 8, s: 2, o: 0.6 }, { t: 60, l: 72, s: 1, o: 0.4 }, { t: 66, l: 28, s: 1.5, o: 0.55 },
  { t: 72, l: 52, s: 2, o: 0.7 }, { t: 78, l: 90, s: 1, o: 0.4 }, { t: 83, l: 16, s: 1.5, o: 0.5 },
  { t: 88, l: 60, s: 1, o: 0.35 }, { t: 92, l: 38, s: 2, o: 0.6 }, { t: 6, l: 44, s: 1, o: 0.4 },
  { t: 30, l: 50, s: 1, o: 0.5 }, { t: 47, l: 24, s: 1.5, o: 0.45 }, { t: 69, l: 80, s: 1.5, o: 0.5 },
  { t: 17, l: 22, s: 1, o: 0.4 }, { t: 41, l: 92, s: 1, o: 0.4 }, { t: 86, l: 76, s: 2, o: 0.6 },
];

export function CosmicPanel() {
  return (
    <div className="relative flex min-h-[34vh] w-full items-end overflow-hidden bg-gradient-to-br from-night via-night-2 to-night px-8 py-10 lg:min-h-screen lg:w-[55%] lg:items-center lg:px-16">
      {/* soft glows */}
      <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-marigold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-80 w-80 rounded-full bg-marigold-soft/10 blur-3xl" />

      {/* starfield */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((star, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-sand"
            style={{ top: `${star.t}%`, left: `${star.l}%`, width: star.s, height: star.s, opacity: star.o }}
          />
        ))}
        {/* a quiet constellation, top-right */}
        <svg className="absolute right-[10%] top-[14%] h-40 w-40 opacity-50" viewBox="0 0 100 100" fill="none">
          <path d="M10 20 L34 38 L52 28 L74 50 L60 74" stroke="#e8a33d" strokeWidth="0.6" strokeOpacity="0.5" />
          {[
            [10, 20], [34, 38], [52, 28], [74, 50], [60, 74],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i === 2 ? 2.4 : 1.6} fill="#f0c074" />
          ))}
        </svg>
      </div>

      {/* brand */}
      <div className="relative z-10 max-w-md">
        <div className="mb-4 text-marigold">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-display text-4xl leading-tight text-sand lg:text-5xl">Astro Consultancy</h1>
        <p className="mt-3 max-w-sm text-sand/70 lg:text-lg">
          Booking, scheduling &amp; payments — your branded practice under one calm night sky.
        </p>
      </div>
    </div>
  );
}
