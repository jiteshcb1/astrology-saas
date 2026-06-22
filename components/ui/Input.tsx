import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** "dark" for use on the night-card surface (sign-in); "light" for dashboards. */
  tone?: "light" | "dark";
}

const tones = {
  light: "bg-white border-line text-ink placeholder:text-muted",
  dark: "bg-night/60 border-line-dark text-sand placeholder:text-sand/40",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, tone = "light", className = "", ...props },
  ref,
) {
  return (
    <label className="block">
      {label && (
        <span className={`mb-1.5 block text-sm ${tone === "dark" ? "text-sand/80" : "text-muted"}`}>
          {label}
        </span>
      )}
      <input
        ref={ref}
        className={`w-full rounded-control border px-4 py-3 text-[0.95rem] outline-none transition focus:border-marigold ${tones[tone]} ${className}`}
        {...props}
      />
    </label>
  );
});
