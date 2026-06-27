"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, CtaLink } from "@/components/marketing/ui";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/for-astrologers", label: "For Astrologers" },
  { href: "/about", label: "About" },
];

// SP-6.1 — sticky public nav: transparent over the (dark) page header, frosted-night after scrolling; mobile
// hamburger opens a full-screen menu. Client component only for the scroll + menu state.
export function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOpen(false), [pathname]); // close on navigation

  return (
    <header className={`sticky top-0 z-50 transition-colors ${scrolled ? "border-b border-line-dark bg-night/85 backdrop-blur-md" : "border-b border-transparent bg-transparent"}`}>
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
        <Logo />
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`text-sm transition ${pathname === l.href ? "text-marigold-soft" : "text-sand/75 hover:text-sand"}`}>
              {l.label}
            </Link>
          ))}
          <CtaLink href="/signin" variant="primary" className="px-5 py-2">Sign in</CtaLink>
        </div>
        <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sand md:hidden">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d={open ? "M6 6l12 12M6 18L18 6" : "M3 6h18M3 12h18M3 18h18"} strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[56px] z-40 bg-night/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1 px-6 py-6">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={`rounded-control px-3 py-3 text-lg ${pathname === l.href ? "text-marigold-soft" : "text-sand"}`}>
                {l.label}
              </Link>
            ))}
            <CtaLink href="/signin" variant="primary" className="mt-3 w-full">Sign in</CtaLink>
          </div>
        </div>
      )}
    </header>
  );
}
