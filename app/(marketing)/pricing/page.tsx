import type { Metadata } from "next";
import type { SubscriptionPlan } from "@prisma/client";
import { listPublicPlans } from "@/lib/billing";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow, CtaLink } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "Pricing — Jyoti",
  description: "Pay a flat subscription, never a commission. Your consultation income is yours, always.",
};

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const prettifyFeature = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface CardData {
  name: string;
  priceLabel: string;
  sub: string;
  features: { label: string; on: boolean }[];
  cta: { href: string; label: string };
  popular?: boolean;
}

function planToCard(plan: SubscriptionPlan, popular: boolean): CardData {
  const featureMap = (plan.features ?? {}) as Record<string, unknown>;
  const features: { label: string; on: boolean }[] = [
    { label: `${plan.includedSeats} team seat${plan.includedSeats === 1 ? "" : "s"} included`, on: true },
    ...(plan.perSeatPrice > 0 ? [{ label: `${rupees(plan.perSeatPrice)}/seat beyond included`, on: true }] : []),
    ...Object.entries(featureMap)
      .filter(([, v]) => v === true)
      .map(([k]) => ({ label: prettifyFeature(k), on: true })),
  ];
  return {
    name: plan.name,
    priceLabel: plan.price === 0 ? "₹0" : `${rupees(plan.price)}`,
    sub: plan.price === 0 ? "free forever" : `billed ${plan.billingInterval}`,
    features: features.length ? features : [{ label: "Your branded booking page", on: true }],
    cta: { href: "/signin", label: plan.price === 0 ? "Start free" : "Start your page" },
    popular,
  };
}

// Illustrative fallback (mockup tiers) shown only when there are no active plans in the DB.
const FALLBACK: CardData[] = [
  { name: "Starter", priceLabel: "₹0", sub: "free forever", cta: { href: "/signin", label: "Start free" }, features: [{ label: "Your branded booking page", on: true }, { label: "Up to 2 packages", on: true }, { label: "UPI QR payments", on: true }, { label: "Email receipts & call links", on: true }, { label: "Own payment gateway", on: false }, { label: "Team members", on: false }] },
  { name: "Professional", priceLabel: "₹499", sub: "billed monthly", popular: true, cta: { href: "/signin", label: "Start free trial" }, features: [{ label: "Everything in Starter", on: true }, { label: "Unlimited packages", on: true }, { label: "Connect your own gateway", on: true }, { label: "Discounts, coupons & GST receipts", on: true }, { label: "Seeker profiles & PDF export", on: true }, { label: "1 team seat included", on: true }] },
  { name: "Studio", priceLabel: "₹999", sub: "billed monthly", cta: { href: "/signin", label: "Choose Studio" }, features: [{ label: "Everything in Professional", on: true }, { label: "3 team seats included", on: true }, { label: "Round-robin call distribution", on: true }, { label: "Accounts role & reconciliation", on: true }, { label: "Priority support", on: true }] },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do you take a cut of my consultation fees?", a: "Never. Jyoti charges only a flat subscription for the software. Every rupee a seeker pays goes directly to you, through your own UPI or payment gateway." },
  { q: "How do team seats work?", a: "Paid plans include team seats; you can add more consulting or accounts members anytime for a small per-seat fee. Calls share out automatically across your team." },
  { q: "Can I start for free?", a: "Yes. The Starter plan is free forever — set up your page, add packages, and take UPI payments without paying us anything." },
  { q: "What payment methods can my seekers use?", a: "On any plan, seekers can pay via UPI QR with proof. On paid plans you can also connect your own gateway for instant card/netbanking confirmation." },
  { q: "Can I cancel anytime?", a: "Absolutely. There are no lock-ins — cancel whenever you like and keep your data." },
];

function PlanCard({ c }: { c: CardData }) {
  const interval = c.priceLabel === "₹0" ? "" : c.sub.includes("yearly") ? "/yr" : "/mo";
  return (
    <div className={`relative flex flex-col rounded-card border bg-white p-6 ${c.popular ? "border-marigold shadow-[0_20px_50px_rgba(232,163,61,0.15)]" : "border-line"}`}>
      {c.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-marigold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-night">Most popular</span>}
      <h3 className="font-display text-xl text-ink">{c.name}</h3>
      <div className="mt-3 font-display text-4xl text-ink">
        {c.priceLabel}
        {interval && <span className="text-base font-normal text-muted">{interval}</span>}
      </div>
      <p className="mt-1 text-xs text-muted">{c.sub}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {c.features.map((f, i) => (
          <li key={i} className={`flex items-start gap-2.5 text-sm ${f.on ? "text-ink" : "text-muted line-through"}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={f.on ? "#4f9d69" : "#9b99a8"} strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden>
              {f.on ? <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />}
            </svg>
            {f.label}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <CtaLink href={c.cta.href} variant={c.popular ? "primary" : "ghost-dark"} className="w-full">{c.cta.label}</CtaLink>
      </div>
    </div>
  );
}

export default async function PricingPage() {
  const plans = await listPublicPlans();
  const usingReal = plans.length > 0;
  const cards: CardData[] = usingReal ? plans.map((p, i) => planToCard(p, plans.length >= 3 ? i === 1 : i === 0)) : FALLBACK;

  return (
    <>
      <CelestialHeader
        eyebrow={<Eyebrow tone="marigold">Simple, honest pricing</Eyebrow>}
        title={<>Pay for the tool. Keep all your earnings.</>}
        subtitle="Jyoti charges a flat subscription — never a commission on your consultations. Your income is yours, always."
      />

      <section className="bg-sand">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className={`mx-auto grid gap-5 ${cards.length >= 3 ? "lg:grid-cols-3" : cards.length === 2 ? "max-w-3xl sm:grid-cols-2" : "max-w-sm"}`}>
            {cards.map((c, i) => <PlanCard key={i} c={c} />)}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted">
            All plans: no commission on your earnings · money goes directly to you · cancel anytime.
            {!usingReal && " Prices shown are illustrative."}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-sand-2">
        <div className="mx-auto w-full max-w-3xl px-6 py-20">
          <h2 className="text-center font-display text-3xl text-ink">Pricing questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-card border border-line bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink">
                  {f.q}
                  <span className="text-marigold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
