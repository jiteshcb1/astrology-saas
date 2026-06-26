import { formatMoney } from "@/lib/money";

// Lightweight SVG monthly bar chart (no charting dependency). Bars scale to the max value.
export function MonthlyBarChart({ data }: { data: { label: string; paise: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.paise));
  return (
    <div className="flex items-end gap-3" style={{ height: 180 }}>
      {data.map((d) => {
        const h = Math.round((d.paise / max) * 140);
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[0.65rem] text-muted">{d.paise > 0 ? formatMoney(d.paise).replace(".00", "") : ""}</span>
            <div className="flex w-full max-w-[44px] flex-1 items-end">
              <div className="w-full rounded-t-control bg-marigold/80 transition-all" style={{ height: Math.max(h, 2) }} title={formatMoney(d.paise)} />
            </div>
            <span className="text-xs text-muted">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
