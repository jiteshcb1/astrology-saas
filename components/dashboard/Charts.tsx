import type { ReactNode } from "react";

const TONE_HEX: Record<string, string> = {
  marigold: "#e8a33d",
  terra: "#b9543a",
  green: "#4f9d69",
  soft: "#f0c074",
  night: "#14122b",
};

export function toneHex(tone: string): string {
  return TONE_HEX[tone] ?? TONE_HEX.marigold;
}

// Tiny inline sparkline for stat cards.
export function Sparkline({ data, tone = "marigold" }: { data: number[]; tone?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 26 - ((v - min) / span) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="h-9 w-full" viewBox="0 0 100 28" preserveAspectRatio="none" fill="none">
      <polyline
        points={pts}
        stroke={toneHex(tone)}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Performance line chart with two series + soft area under the first.
export function LineAreaChart({
  series,
  labels,
}: {
  series: { data: number[]; tone: string }[];
  labels: string[];
}) {
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const toPath = (data: number[]) =>
    data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 46 - ((v - min) / span) * 42;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div>
      <svg className="h-48 w-full" viewBox="0 0 100 50" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="area0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={toneHex(series[0].tone)} stopOpacity="0.18" />
            <stop offset="100%" stopColor={toneHex(series[0].tone)} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${toPath(series[0].data)} L100 50 L0 50 Z`} fill="url(#area0)" stroke="none" />
        {series.map((s, i) => (
          <path
            key={i}
            d={toPath(s.data)}
            stroke={toneHex(s.tone)}
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted">
        {labels.filter((_, i) => i % 3 === 0).map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// Donut from percentage slices, with a center label.
export function DonutChart({
  slices,
  center,
}: {
  slices: { pct: number; tone: string }[];
  center?: ReactNode;
}) {
  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-full w-full" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f6efe2" strokeWidth="4" />
        {slices.map((s, i) => {
          const prior = slices.slice(0, i).reduce((sum, x) => sum + x.pct, 0);
          return (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke={toneHex(s.tone)}
              strokeWidth="4"
              strokeDasharray={`${s.pct} ${100 - s.pct}`}
              strokeDashoffset={25 - prior}
            />
          );
        })}
      </svg>
      {center ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
      ) : null}
    </div>
  );
}
