import type { Delta } from "@/lib/admin-dashboard";

// Delta display rules (SP-5.5): positive → green "↑ N this month"; zero → muted "No new this month";
// null (insufficient history < 30 days) → render nothing (never a misleading comparison).
export function DeltaBadge({ delta, noun = "this month" }: { delta: Delta | null; noun?: string }) {
  if (!delta) return null;
  if (delta.value <= 0) return <span className="text-xs text-muted">No new {noun}</span>;
  return <span className="text-xs font-medium text-green">↑ {delta.value} {noun}</span>;
}
