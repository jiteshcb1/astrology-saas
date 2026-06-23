import type { ReactNode } from "react";

const DefaultIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="11" cy="11" r="7" />
    <path d="M11 8v3M11 14h.01M20 20l-3.5-3.5" strokeLinecap="round" />
  </svg>
);

export function EmptyState({
  title,
  message,
  icon,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="text-muted">{icon ?? DefaultIcon}</div>
      <p className="font-display text-ink">{title}</p>
      {message ? <p className="max-w-sm text-sm text-muted">{message}</p> : null}
    </div>
  );
}
