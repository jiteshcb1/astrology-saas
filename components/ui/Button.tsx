import type { ButtonHTMLAttributes } from "react";
import { CosmicLoader } from "@/components/ui/CosmicLoader";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** SP-5.6: when true, show the Cosmic loader + loadingLabel and disable (prevents double-submit). */
  loading?: boolean;
  /** Label shown while loading (defaults to the button's children). */
  loadingLabel?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-control transition disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-marigold text-night px-4 py-3 shadow-[0_6px_20px_rgba(232,163,61,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(232,163,61,0.35)]",
  ghost: "bg-white border border-line text-ink px-4 py-2.5 hover:border-marigold",
};

export function Button({ variant = "primary", className = "", loading = false, loadingLabel, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <>
          <CosmicLoader size="sm" variant="auto" />
          <span>{loadingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
