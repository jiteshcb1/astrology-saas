"use client";

export function PrintButton({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-control px-4 py-2 text-sm font-semibold print:hidden" style={style}>
      {label}
    </button>
  );
}
