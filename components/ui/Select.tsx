import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className = "", children, ...props },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm text-muted">{label}</span>}
      <select
        ref={ref}
        className={`w-full rounded-control border border-line bg-white px-4 py-3 text-[0.95rem] text-ink outline-none transition focus:border-marigold ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
});
