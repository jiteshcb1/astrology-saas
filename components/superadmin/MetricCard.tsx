export function MetricCard({
  label,
  value,
  hint,
  filled,
}: {
  label: string;
  value: string;
  hint?: string;
  filled?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-5 ${
        filled ? "border-transparent bg-gradient-to-br from-night to-night-2 text-sand" : "border-line bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-sm ${filled ? "text-sand/70" : "text-muted"}`}>{label}</span>
        <span
          className={`grid h-7 w-7 place-items-center rounded-full ${
            filled ? "bg-sand/15 text-sand" : "border border-line text-muted"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className={`mt-3 font-display text-3xl ${filled ? "text-sand" : "text-ink"}`}>{value}</div>
      {hint ? <div className={`mt-1 text-xs ${filled ? "text-sand/60" : "text-muted"}`}>{hint}</div> : null}
    </div>
  );
}
