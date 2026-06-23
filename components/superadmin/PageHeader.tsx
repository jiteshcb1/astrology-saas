import type { ReactNode } from "react";

// Consistent sticky top bar for every superadmin page: title on the left, optional action slot.
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-4 md:px-8">
      <h1 className="font-display text-xl text-ink">{title}</h1>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
