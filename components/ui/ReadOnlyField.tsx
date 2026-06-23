import type { ReactNode } from "react";

// Displays read-only data inside forms/detail views as a proper labeled field (not loose grey text).
export function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <div className="rounded-control border border-line bg-sand-2/40 px-4 py-2.5 text-sm text-ink">
        {children}
      </div>
    </div>
  );
}
