import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-control transition disabled:opacity-60 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-marigold text-night px-4 py-3 shadow-[0_6px_20px_rgba(232,163,61,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(232,163,61,0.35)]",
  ghost: "bg-white border border-line text-ink px-4 py-2.5 hover:border-marigold",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
