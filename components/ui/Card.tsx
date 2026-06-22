import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-card border border-line bg-white p-6 ${className}`} {...props} />
  );
}
