import { utcToZonedParts, zonedClockToUtc } from "@/lib/timezone";

// SP-5.6 shared month bucketing for the dashboard charts (all in IST). One datum shape across every chart so
// the recharts views (components/ui/charts.tsx) stay generic; data fns live with their queries in lib/.
const TZ = "Asia/Kolkata";
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");

export interface ChartDatum {
  key: string; // "YYYY-MM" (or packageId for bookings-by-package) — appended to hrefBase on click
  label: string; // short axis label, e.g. "Jun"
  full: string; // tooltip/category label, e.g. "June 2026" (or package title)
  value: number; // paise or count
  count: number; // secondary count (bookings / subscriptions)
  pct?: number; // share of total (bookings-by-package only)
}
export interface MonthBucket {
  key: string;
  label: string;
  full: string;
}

export function monthKeyOf(d: Date): string {
  const p = utcToZonedParts(d, TZ);
  return `${p.year}-${pad(p.month)}`;
}

// The last `count` months ending at `now` (oldest → newest), each with display labels.
export function monthSeries(now: Date, count: number): MonthBucket[] {
  const p = utcToZonedParts(now, TZ);
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    let y = p.year;
    let m = p.month - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    out.push({ key: `${y}-${pad(m)}`, label: SHORT[m - 1], full: `${FULL[m - 1]} ${y}` });
  }
  return out;
}

// UTC instant for 00:00 on the 1st of a "YYYY-MM" key (in IST) — the lower bound for that window's query.
export function monthStartUtcOf(key: string): Date {
  return zonedClockToUtc(`${key}-01`, "00:00", TZ);
}

// Compact rupee label (₹1K / ₹10K / ₹1.2L) for axis ticks + the screen-reader chart summary.
export function inrShort(paise: number): string {
  const r = paise / 100;
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString(); // 1 decimal, trailing .0 dropped
  if (r >= 1e7) return `₹${fmt(r / 1e7)}Cr`;
  if (r >= 1e5) return `₹${fmt(r / 1e5)}L`;
  if (r >= 1e3) return `₹${r >= 1e4 ? Math.round(r / 1e3) : fmt(r / 1e3)}K`;
  return `₹${Math.round(r)}`;
}

// Plain-text data summary for the chart container's aria-label (screen-reader fallback for the SVG).
export function chartAriaLabel(metric: string, data: ChartDatum[], unit: "inr" | "count"): string {
  const parts = data.map((d) => `${unit === "inr" ? inrShort(d.value) : d.value} in ${d.full}`);
  return `${metric}: ${parts.join(", ") || "no data yet"}.`;
}
