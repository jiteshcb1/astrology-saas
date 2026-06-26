"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// SP-5.6 reusable recharts views (client). Server wrappers fetch data + handle empty/Suspense and pass a
// serializable `hrefBase` for click-to-filter (functions can't cross the server→client boundary).
import { inrShort, type ChartDatum } from "@/lib/month-series";
export type { ChartDatum };

const MARIGOLD = "#e8a33d";

function inrFull(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

// Respect prefers-reduced-motion (default to animating; flip off if the user opted out).
function useAnimate(): boolean {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnimate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return animate;
}

type TooltipKind = "earnings" | "revenue" | "growth" | "bookings";
interface TipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  kind: TooltipKind;
}
function ChartTooltip({ active, payload, kind }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  let line: string;
  if (kind === "earnings") line = `${inrFull(d.value)} in ${d.full} from ${d.count} confirmed booking${d.count === 1 ? "" : "s"}`;
  else if (kind === "revenue") line = `${inrFull(d.value)} from ${d.count} subscription${d.count === 1 ? "" : "s"} in ${d.full}`;
  else if (kind === "growth") line = `${d.value} total consultant${d.value === 1 ? "" : "s"} as of ${d.full}`;
  else line = `${d.value} booking${d.value === 1 ? "" : "s"}${d.pct != null ? ` — ${d.pct}% of your sessions` : ""}`;
  return (
    <div className="rounded-control border border-line bg-white px-3 py-2 text-xs text-ink shadow-[0_8px_24px_rgba(20,18,43,0.12)]">
      {kind !== "bookings" && <div className="font-medium">{d.full}</div>}
      <div className="text-muted">{line}</div>
    </div>
  );
}

const axisTick = { fontSize: 11, fill: "rgba(42,39,72,0.6)" };

// ── Vertical bar (earnings / revenue) ──────────────────────────────────────────
export function BarChartView({
  data,
  color = MARIGOLD,
  currentKey,
  kind,
  hrefBase,
  height = 200,
}: {
  data: ChartDatum[];
  color?: string;
  currentKey?: string;
  kind: "earnings" | "revenue";
  hrefBase?: string;
  height?: number;
}) {
  const router = useRouter();
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis tickFormatter={(v) => inrShort(Number(v))} tickLine={false} axisLine={false} width={42} tick={axisTick} />
        <Tooltip cursor={{ fill: "rgba(232,163,61,0.08)" }} content={<ChartTooltip kind={kind} />} />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          isAnimationActive={animate}
          animationDuration={600}
          onClick={hrefBase ? (d: unknown) => navigateTo(router, hrefBase, d) : undefined}
          cursor={hrefBase ? "pointer" : undefined}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={currentKey && d.key === currentKey ? darken(color) : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Area (cumulative growth) ───────────────────────────────────────────────────
export function AreaChartView({ data, color = MARIGOLD, height = 200 }: { data: ChartDatum[]; color?: string; height?: number }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cl-growth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={axisTick} />
        <Tooltip content={<ChartTooltip kind="growth" />} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#cl-growth)" isAnimationActive={animate} animationDuration={600} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Horizontal bar (bookings by package) ───────────────────────────────────────
export function HorizontalBarChartView({
  data,
  primary = "#14122b",
  secondary = MARIGOLD,
  hrefBase,
  height = 220,
}: {
  data: ChartDatum[];
  primary?: string;
  secondary?: string;
  hrefBase?: string;
  height?: number;
}) {
  const router = useRouter();
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="cl-pkg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
        </defs>
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
        <YAxis type="category" dataKey="full" width={110} tickLine={false} axisLine={false} tick={{ ...axisTick, fontSize: 12 }} />
        <Tooltip cursor={{ fill: "rgba(232,163,61,0.08)" }} content={<ChartTooltip kind="bookings" />} />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          fill="url(#cl-pkg)"
          isAnimationActive={animate}
          animationDuration={600}
          onClick={hrefBase ? (d: unknown) => navigateTo(router, hrefBase, d) : undefined}
          cursor={hrefBase ? "pointer" : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// recharts passes the clicked bar (a BarRectangleItem carrying the original datum on `.payload`).
function navigateTo(router: ReturnType<typeof useRouter>, hrefBase: string, data: unknown) {
  const key = (data as { payload?: ChartDatum })?.payload?.key;
  if (key) router.push(`${hrefBase}${key}`);
}

// Darken a hex color ~15% for the current-month emphasis bar.
function darken(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = 0.82;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
