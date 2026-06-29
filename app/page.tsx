import type { Metadata } from "next";
import { listPublicPlans } from "@/lib/billing";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { HomeClient } from "@/components/home/HomeClient";

export const metadata: Metadata = {
  title: "Jyoti — Your astrology practice, beautifully online",
  description: "A branded booking home for astrology consultants: scheduling, your own payments, teams, and seeker records — you keep every rupee. In Hindi, English, or Hinglish.",
};

// Pricing teaser + promo banner read the DB.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const plans = await listPublicPlans();
  const byName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), Math.round(p.price / 100)]));
  const dbMonthly = { starter: byName.get("starter"), pro: byName.get("pro"), max: byName.get("max") };

  return (
    <>
      {/* Geometric display font for the Celestial homepage (homepage-scoped; falls back to Inter). */}
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" />
      <PromoBanner />
      <HomeClient dbMonthly={dbMonthly} />
    </>
  );
}
