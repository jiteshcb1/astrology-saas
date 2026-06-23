import type { ReactNode } from "react";
import { Sparkline, toneHex } from "./Charts";
import type { DemoMetric } from "@/lib/demo-data";

const ICONS: Record<string, ReactNode> = {
  revenue: <path d="M2 5h16v11H2zM2 9h16" strokeLinecap="round" />,
  bookings: <><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" /></>,
  seekers: <><circle cx="7" cy="7" r="3" /><path d="M2 17c0-3 2-5 5-5s5 2 5 5M13 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" /></>,
  rating: <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.3 5.2 16.9l.9-5.4L2.2 7.7l5.4-.8z" strokeLinejoin="round" />,
};

export function StatCardSparkline({ metric }: { metric: DemoMetric }) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-white" style={{ backgroundColor: toneHex(metric.tone) }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            {ICONS[metric.key] ?? ICONS.revenue}
          </svg>
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm text-muted">{metric.label}</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-ink">{metric.value}</span>
            <span className={`text-xs ${metric.deltaUp ? "text-green" : "text-terra"}`}>
              {metric.deltaUp ? "▲" : "▼"} {metric.delta}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Sparkline data={metric.spark} tone={metric.tone} />
      </div>
      <div className="mt-1 text-xs text-muted">vs last 7 days</div>
    </div>
  );
}
