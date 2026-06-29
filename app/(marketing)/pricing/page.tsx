import type { Metadata } from "next";
import { listPublicPlans } from "@/lib/billing";
import { PricingView } from "@/components/marketing/PricingView";

export const metadata: Metadata = {
  title: "Pricing — Jyoti",
  description: "A flat subscription, never a commission. Four plans from free to Enterprise — keep every rupee you earn.",
};

// Always reflect the latest plans from the DB.
export const dynamic = "force-dynamic";

// Monthly base price (rupees) from a matching active DB plan, by name. Yearly + features + Enterprise are
// hardcoded marketing copy in PricingView; this only overrides the displayed monthly number when present.
export default async function PricingPage() {
  const plans = await listPublicPlans();
  const byName = new Map(plans.map((p) => [p.name.trim().toLowerCase(), Math.round(p.price / 100)]));
  const dbMonthly = {
    starter: byName.get("starter"),
    pro: byName.get("pro"),
    max: byName.get("max"),
  };
  return <PricingView dbMonthly={dbMonthly} />;
}
