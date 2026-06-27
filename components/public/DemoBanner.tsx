import Link from "next/link";

// SP-6.2 — subtle sticky bar shown on the demo consultant's public page. PublicProfile hides it once the
// booking drawer opens so the flow is experienced cleanly.
export function DemoBanner() {
  return (
    <div className="sticky top-0 z-40 bg-night text-sand">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold text-marigold-soft">Demo</span>
          <span className="hidden sm:inline"> — this is what your own page could look like.</span>
        </span>
        <Link href="/signin" className="shrink-0 rounded-full bg-marigold px-4 py-1.5 text-xs font-semibold text-night transition hover:brightness-105">
          Start your page →
        </Link>
      </div>
    </div>
  );
}
