import type { ReactNode } from "react";

// Consistent sticky top bar for admin pages: title (+ optional subtitle) on the left, optional
// action slot on the right.
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4 md:px-8">
      <div className="min-w-0">
        <h1 className="font-display text-xl text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
