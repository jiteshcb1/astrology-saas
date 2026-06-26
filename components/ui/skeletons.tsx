// SP-5.5 skeleton loading states — pure CSS shimmer (.shimmer in globals.css), zero layout shift.
// Skeletons are decorative (aria-hidden); Suspense swaps them for real content with matching dimensions.

// Matches MetricCard: rounded-card border p-5, label(text-sm) + value(text-3xl) + hint(text-xs).
export function StatCardSkeleton() {
  return (
    <div aria-hidden className="rounded-card border border-line bg-white p-5">
      <div className="shimmer h-5 w-2/5 rounded" />
      <div className="shimmer mt-3 h-9 w-3/5 rounded" />
      <div className="shimmer mt-1 h-4 w-1/2 rounded" />
    </div>
  );
}

export function StatCardSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Bordered card with an uppercase header row + N shimmer rows (avatar + two text lines + meta + chip).
export function TableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div aria-busy className="overflow-hidden rounded-card border border-line bg-white">
      <div className="border-b border-line bg-sand-2/40 px-4 py-2.5">
        <div className="shimmer h-3 w-24 rounded" />
      </div>
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
          <div className="shimmer h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="shimmer h-3 w-1/3 rounded" />
            <div className="shimmer h-2.5 w-1/4 rounded" />
          </div>
          <div className="shimmer hidden h-3 w-20 rounded sm:block" />
          <div className="shimmer h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// A plain shimmer rectangle at the exact chart dimensions, with an optional readable caption underneath.
export function ChartSkeleton({ height = 180, label }: { height?: number; label?: string }) {
  return (
    <div>
      <div aria-hidden className="shimmer w-full rounded-card" style={{ height }} />
      {label ? <p className="mt-2 text-center text-xs text-muted">{label}</p> : null}
    </div>
  );
}

// Heading shimmer + content rows (only the data area shimmers; spacing preserved by the caller).
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy>
      <div className="shimmer mb-3 h-4 w-32 rounded" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} aria-hidden className="shimmer h-12 w-full rounded-control" />
        ))}
      </div>
    </div>
  );
}

// Matches SetupChecklist: progress line + 5 rows (circle + label).
export function ChecklistSkeleton() {
  return (
    <div aria-busy>
      <div className="shimmer mb-2 h-4 w-28 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} aria-hidden className="flex items-center gap-3 border-b border-line py-3 last:border-0">
          <div className="shimmer h-6 w-6 shrink-0 rounded-full" />
          <div className="shimmer h-3 flex-1 rounded" />
        </div>
      ))}
    </div>
  );
}
