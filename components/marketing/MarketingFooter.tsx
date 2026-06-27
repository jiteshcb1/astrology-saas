import Link from "next/link";
import { Logo } from "@/components/marketing/ui";

// SP-6.1 — shared footer across all marketing pages.
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  { heading: "Product", links: [{ href: "/features", label: "Features" }, { href: "/pricing", label: "Pricing" }, { href: "/how-it-works", label: "How it works" }] },
  { heading: "For Consultants", links: [{ href: "/for-astrologers", label: "For Astrologers" }, { href: "/signin", label: "Start your page" }, { href: "/get-started", label: "Book a free demo" }] },
  { heading: "Company", links: [{ href: "/about", label: "About" }, { href: "/terms", label: "Terms" }, { href: "/privacy", label: "Privacy" }] },
];

export function MarketingFooter() {
  return (
    <footer className="bg-night text-sand/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-sand/55">Your astrology practice, online — bookings, payments, and clients in one calm place.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sand/45">{col.heading}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-sand/70 transition hover:text-marigold-soft">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-line-dark pt-6 text-xs text-sand/45 sm:flex-row sm:items-center">
          <span>© 2026 Jyoti — payments go directly to you; we never hold your money.</span>
          <span>Powered by HiFi AI</span>
        </div>
      </div>
    </footer>
  );
}
