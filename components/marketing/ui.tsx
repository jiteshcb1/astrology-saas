import Link from "next/link";
import type { ReactNode } from "react";

// SP-6.1 marketing primitives. The brand is "Jyoti" (the consumer name used across the mockups + onboarding);
// "Astro Consultancy" is only the repo/internal name. Colors come from the global @theme tokens.

// The Jyoti sun/compass mark (same glyph as the onboarding logo).
export function SunMark({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ dark = true }: { dark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-logo text-xl ${dark ? "text-sand" : "text-ink"}`}>
      <span className="text-marigold"><SunMark /></span>
      Jyoti
    </Link>
  );
}

// Section eyebrow — small uppercase label above a heading.
export function Eyebrow({ children, tone = "terra" }: { children: ReactNode; tone?: "terra" | "marigold" }) {
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${tone === "marigold" ? "border-marigold/40 text-marigold-soft" : "border-terra/40 text-terra"}`}>
      {children}
    </span>
  );
}

type CtaVariant = "primary" | "ghost-light" | "ghost-dark";
const ctaCls: Record<CtaVariant, string> = {
  primary: "bg-marigold text-night shadow-[0_8px_24px_rgba(232,163,61,0.25)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(232,163,61,0.35)]",
  "ghost-light": "border border-[rgba(240,224,192,0.3)] text-sand hover:border-marigold",
  "ghost-dark": "border border-line bg-white text-ink hover:border-marigold",
};

// Pill CTA link — the marketing aesthetic (rounded-full), distinct from the dashboard Button.
export function CtaLink({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: CtaVariant; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${ctaCls[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// Dark closing CTA band, reused at the bottom of several pages.
export function CtaBand({ title, body, primary, secondary }: { title: string; body?: string; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <section className="relative overflow-hidden text-sand" style={{ background: "radial-gradient(ellipse at 50% 120%, #2a2552 0%, #0f0d22 100%)" }}>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
        {body && <p className="mx-auto mt-3 max-w-xl text-sand/75">{body}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <CtaLink href={primary.href} variant="primary">{primary.label}</CtaLink>
          {secondary && <CtaLink href={secondary.href} variant="ghost-light">{secondary.label}</CtaLink>}
        </div>
      </div>
    </section>
  );
}
