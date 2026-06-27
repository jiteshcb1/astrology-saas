import type { ReactNode } from "react";
import { HeroBackground } from "@/components/public/HeroBackground";
import { Eyebrow } from "@/components/marketing/ui";

// SP-6.1 — the dark, celestial page header shared by the landing hero and every inner page's top band.
// Reuses the public profile's rotating-zodiac + drifting-stars backdrop (reduced-motion handled in globals.css).
export function CelestialHeader({
  eyebrow,
  title,
  subtitle,
  children,
  size = "md",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode; // CTAs / extra content under the subtitle
  size?: "md" | "lg";
}) {
  return (
    <header
      className="relative overflow-hidden text-sand"
      style={{ background: "radial-gradient(ellipse at 50% -10%, #26224d 0%, #14122b 55%, #0f0d22 100%)" }}
    >
      <HeroBackground style="stars_zodiac" tint="#f0c074" />
      <div className={`relative mx-auto w-full max-w-5xl px-6 text-center ${size === "lg" ? "py-24 sm:py-32" : "py-20 sm:py-24"}`}>
        {eyebrow && <div className="mb-5">{eyebrow}</div>}
        <h1 className="mx-auto max-w-3xl font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-5 max-w-2xl text-base text-sand/75 sm:text-lg">{subtitle}</p>}
        {children && <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{children}</div>}
      </div>
    </header>
  );
}

export { Eyebrow };
