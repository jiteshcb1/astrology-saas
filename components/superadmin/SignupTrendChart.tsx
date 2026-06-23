import type { TrendBucket } from "@/lib/admin-dashboard";

// Lightweight inline bar chart — no chart dependency.
export function SignupTrendChart({ data }: { data: TrendBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-32 items-end gap-3">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-marigold"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              title={String(d.count)}
            />
          </div>
          <span className="text-xs text-muted">{d.label}</span>
          <span className="text-xs text-ink">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
