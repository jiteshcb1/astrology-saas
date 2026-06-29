"use client";

import { useEffect, useRef, useState } from "react";
import { resolveBrand } from "@/lib/branding";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageCard } from "@/components/public/PackageCard";
import { BookingDrawer } from "@/components/public/BookingDrawer";
import { DemoBanner } from "@/components/public/DemoBanner";
import { SocialIcons } from "@/components/public/SocialIcons";
import { HeroBackground } from "@/components/public/HeroBackground";
import type { PublicPackageView } from "@/lib/public-page";

export interface ProfileInfo {
  displayName: string;
  bio: string;
  experience: string;
  specialities: string[];
  socialLinks: Record<string, string>;
}
export interface BrandingInfo {
  themeColor?: string | null;
  logoUrl?: string | null;
  backgroundStyle?: string;
}

function extractYears(s: string): number | null {
  const m = s.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?|वर्ष|साल)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function PublicProfile({
  profile,
  branding,
  packages,
  orgName,
  slug,
  timezone = "Asia/Kolkata",
  confirmedCount = 0,
  legal,
  getSlots,
  onContinue,
  demo = false,
  paymentPreview,
  initialPackageSlug,
}: {
  profile: ProfileInfo;
  branding: BrandingInfo;
  packages: PublicPackageView[];
  orgName?: string;
  slug?: string;
  timezone?: string;
  confirmedCount?: number;
  legal?: { hasPrivacy: boolean; hasTerms: boolean };
  getSlots?: (packageId: string, durationMin: number, fromISO: string, toISO: string) => Promise<string[]>;
  onContinue?: (packageId: string, durationMin: number, startISO: string) => Promise<{ ok: boolean; bookingId?: string; reason?: string }>;
  // SP-6.2 demo mode — show the banner and run the no-write demo booking flow.
  demo?: boolean;
  paymentPreview?: { upiVpa: string | null; qrUrl: string | null } | null;
  // SP-7.1 deep link: /<slug>/<packageSlug> (or ?pkg=) opens this package's booking drawer on load.
  initialPackageSlug?: string;
}) {
  const { primary, onPrimary, secondary, onSecondary } = resolveBrand(branding.themeColor);
  const name = profile.displayName || orgName || "Your name";
  const initial = (name.trim()[0] ?? "A").toUpperCase();

  // Seed the drawer open from the deep link (derived initial state → no effect, no flicker).
  const deepLinked = initialPackageSlug ? packages.find((p) => p.slug === initialPackageSlug) ?? null : null;
  const [selectedPkg, setSelectedPkg] = useState<PublicPackageView | null>(deepLinked);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(deepLinked));
  const [showSticky, setShowSticky] = useState(false);
  const [imgError, setImgError] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function openPackage(p: PublicPackageView) {
    setSelectedPkg(p);
    setDrawerOpen(true);
  }
  function bookCta() {
    if (packages.length === 1) return openPackage(packages[0]);
    document.getElementById("packages")?.scrollIntoView({ behavior: "smooth" });
  }

  const years = extractYears(profile.experience) ?? extractYears(profile.bio);
  const stats: { value: string; label: string }[] = [];
  if (confirmedCount > 0) stats.push({ value: `${confirmedCount}+`, label: "Sessions" });
  if (years) stats.push({ value: `${years}+`, label: "Years" });
  if (profile.specialities.length > 0) stats.push({ value: String(profile.specialities.length), label: "Specialities" });

  const showPhoto = branding.logoUrl && !imgError;
  // Photo with a verified-style badge; monogram fallback uses ink on white (always readable on any theme).
  const heroPhoto = (size: string, textSize: string) => (
    <div className="relative inline-block">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={branding.logoUrl!} alt={name} loading="eager" onError={() => setImgError(true)} className={`${size} rounded-full bg-white object-cover ring-4 ring-white/70`} />
      ) : (
        <span className={`grid ${size} place-items-center rounded-full bg-white font-display ${textSize} text-ink ring-4 ring-white/70`}>{initial}</span>
      )}
      <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full ring-2 ring-white" style={{ backgroundColor: secondary, color: onSecondary }} aria-label="Verified consultant">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand">
      {/* SP-6.2 demo banner — hidden once the booking drawer opens for a clean flow. */}
      {demo && !drawerOpen && <DemoBanner />}

      {/* Sticky mini-header (suppressed in demo so it doesn't fight the banner). */}
      <div className={`fixed inset-x-0 top-0 z-30 border-b border-line bg-white/95 backdrop-blur transition-all duration-300 ${!demo && showSticky ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}>
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl!} alt={name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full font-display text-sm" style={{ backgroundColor: primary, color: onPrimary }}>{initial}</span>
          )}
          <span className="min-w-0 flex-1 truncate font-display text-base text-ink">{name}</span>
          <button type="button" onClick={bookCta} className="rounded-control px-4 py-2 text-sm font-semibold" style={{ backgroundColor: primary, color: onPrimary }}>Book a session</button>
        </div>
      </div>

      {/* Hero */}
      <header ref={heroRef} className="relative overflow-hidden px-6 pb-16 pt-14 text-center" style={{ backgroundColor: primary, color: onPrimary }}>
        <HeroBackground style={branding.backgroundStyle ?? "stars_zodiac"} tint={onPrimary} />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center">
          <div className="mb-5">{heroPhoto("h-32 w-32", "text-5xl")}</div>
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">{name}</h1>
          {orgName && orgName !== name && <p className="mt-1 text-sm opacity-80">{orgName}</p>}
          {profile.bio && <p className="mx-auto mt-3 max-w-xl text-lg italic leading-relaxed opacity-95">{profile.bio}</p>}

          {profile.specialities.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-1.5">
              {profile.specialities.slice(0, 6).map((s) => (
                <span key={s} className="rounded-full bg-white/20 px-3 py-1 text-xs">{s}</span>
              ))}
            </div>
          )}

          {stats.length > 0 && (
            <div className="mt-5 flex max-w-full gap-2.5 overflow-x-auto pb-1">
              {stats.map((st) => (
                <span key={st.label} className="inline-flex shrink-0 items-baseline gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5">
                  <span className="font-display text-lg leading-none">{st.value}</span>
                  <span className="text-xs opacity-80">{st.label}</span>
                </span>
              ))}
            </div>
          )}

          <SocialIcons links={profile.socialLinks} variant="round" tone="ivory" className="mt-5 justify-center" />

          <button type="button" onClick={bookCta} className="mt-7 rounded-control bg-white px-7 py-3 text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.18)]" style={{ color: primary }}>
            Book a session
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        {/* Section 1 — Book a Session */}
        <section id="packages" className="scroll-mt-20">
          <h2 className="mb-5 text-center font-display text-2xl text-ink">Book a Session</h2>
          {packages.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-white/50">
              <EmptyState variant="no_packages_public" />
            </div>
          ) : (
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {packages.map((p) => (
                <PackageCard key={p.id} title={p.title} durationLabel={p.durationLabel} priceLabel={p.priceLabel} descriptionHtml={p.descriptionHtml} themeColor={primary} ctaLabel="Book" onSelect={() => openPackage(p)} />
              ))}
            </div>
          )}
        </section>

        {/* Section 2 — About */}
        {(profile.experience.trim() || Object.keys(profile.socialLinks).length > 0) && (
          <section className="rounded-card border border-line bg-white p-6 sm:p-8">
            <h2 className="mb-4 font-display text-2xl text-ink">About {name.split(" ")[0]}</h2>
            {profile.experience.trim() && (
              <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink/80">{profile.experience}</p>
            )}
            {profile.specialities.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {profile.specialities.map((s) => (
                  <span key={s} className="rounded-full border border-line px-3 py-1 text-xs text-ink">{s}</span>
                ))}
              </div>
            )}
            {Object.keys(profile.socialLinks).length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-sm text-muted">Find me on</p>
                <SocialIcons links={profile.socialLinks} variant="card" />
              </div>
            )}
          </section>
        )}

        <footer className="space-y-3 text-center">
          {slug && (legal?.hasTerms || legal?.hasPrivacy) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {legal?.hasTerms && (
                <a href={`/${slug}/terms`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:border-marigold hover:text-terra">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M6 3h8l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" /><path d="M8 11h8M8 15h5" strokeLinecap="round" /></svg>
                  Terms &amp; Conditions
                </a>
              )}
              {legal?.hasPrivacy && (
                <a href={`/${slug}/privacy`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:border-marigold hover:text-terra">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" /></svg>
                  Privacy Policy
                </a>
              )}
            </div>
          )}
          <p className="text-xs text-muted">Powered by Astro Consultancy</p>
        </footer>
      </div>

      <BookingDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} pkg={selectedPkg} slug={slug} timezone={timezone} accent={primary} onAccent={onPrimary} getSlots={getSlots} onContinue={onContinue} demo={demo} paymentPreview={paymentPreview} />
    </div>
  );
}
