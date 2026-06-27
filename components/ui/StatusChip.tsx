type Tone = "success" | "danger" | "neutral" | "warning" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-green/15 text-green",
  danger: "bg-terra/15 text-terra",
  warning: "bg-marigold/20 text-ink",
  neutral: "bg-line text-muted",
  info: "bg-night/10 text-night",
};

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${TONES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

// Conventional mappings reused across the admin tables.
export function orgStatusTone(status: string): Tone {
  return status === "active" ? "success" : "danger";
}

export function subStatusTone(status: string): Tone {
  if (status === "active") return "success";
  if (status === "past_due") return "warning";
  return "danger";
}

// SP-6.3 lead pipeline: new=marigold, contacted=indigo, demo_booked/converted=green, not_interested=muted.
export function leadStatusTone(status: string): Tone {
  if (status === "new") return "warning";
  if (status === "contacted") return "info";
  if (status === "demo_booked" || status === "converted") return "success";
  return "neutral";
}

// "demo_booked" → "demo booked" for display (StatusChip capitalizes).
export function leadStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
