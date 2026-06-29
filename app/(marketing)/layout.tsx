import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PromoBanner } from "@/components/marketing/PromoBanner";

// SP-6.1 — shared chrome for the public marketing site. Kept separate from the dashboard / public-booking /
// superadmin layouts so nav + footer never leak into those areas.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* SP — promo line sits above the sticky nav at the very top of every marketing page (when active). */}
      <PromoBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </>
  );
}
