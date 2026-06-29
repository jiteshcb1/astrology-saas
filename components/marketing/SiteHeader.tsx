"use client";

import { useState } from "react";
import Link from "next/link";

// One shared site header used on the home page AND every marketing page, so the header matches everywhere.
// Dark frosted bar (warm tokens: night / sand / marigold) that reads well over both light and dark page bodies.
// The language toggle only appears when lang props are supplied (the home page wires its i18n in; the other
// marketing pages aren't translated, so they render the same header without the toggle).

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-astrologers", label: "For Astrologers" },
  { href: "/about", label: "About" },
];

function SunMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
    </svg>
  );
}

export interface SiteHeaderLang {
  lang: string;
  langs: { code: string; label: string }[];
  onLang: (code: string) => void;
}

export function SiteHeader({ i18n }: { i18n?: SiteHeaderLang }) {
  const [open, setOpen] = useState(false);
  const Toggle = i18n ? (
    <div className="flex overflow-hidden rounded-full border border-line-dark">
      {i18n.langs.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => i18n.onLang(l.code)}
          className={`px-3 py-1.5 text-xs transition ${i18n.lang === l.code ? "bg-marigold font-semibold text-night" : "text-sand/70 hover:text-sand"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-line-dark bg-night/85 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold text-sand">
          <span className="text-marigold"><SunMark /></span>Jyoti
        </Link>
        <div className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-sand/75 transition hover:text-sand">{l.label}</Link>
          ))}
          {Toggle}
          <Link href="/signin" className="text-sm text-sand/75 transition hover:text-sand">Sign in</Link>
          <Link href="/signin" className="rounded-full bg-marigold px-5 py-2 text-sm font-semibold text-night transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(232,163,61,0.4)]">Start free →</Link>
        </div>
        <div className="flex items-center gap-3 lg:hidden">
          {Toggle}
          <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sand">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? "M6 6l12 12M6 18L18 6" : "M3 6h18M3 12h18M3 18h18"} strokeLinecap="round" /></svg>
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-line-dark bg-night px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-control px-2 py-2.5 text-base text-sand">{l.label}</Link>
            ))}
            <Link href="/signin" onClick={() => setOpen(false)} className="rounded-control px-2 py-2.5 text-base text-sand">Sign in</Link>
            <Link href="/signin" className="mt-2 rounded-full bg-marigold px-5 py-2.5 text-center text-sm font-semibold text-night">Start free →</Link>
          </div>
        </div>
      )}
    </header>
  );
}
