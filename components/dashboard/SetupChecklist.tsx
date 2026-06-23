import Link from "next/link";

export interface ChecklistItem {
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
  soon?: boolean;
}

export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div>
      <div className="mb-2 text-sm text-muted">
        {doneCount} of {items.length} complete
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                it.done ? "border-green bg-green/15 text-green" : "border-marigold text-marigold"
              }`}
            >
              {it.done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span className={`flex-1 text-sm ${it.done ? "text-muted line-through" : "text-ink"}`}>{it.label}</span>
            {it.soon ? (
              <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">Soon</span>
            ) : it.href && !it.done ? (
              <Link href={it.href} className="text-sm text-terra hover:underline">
                {it.cta ?? "Set up"} →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
