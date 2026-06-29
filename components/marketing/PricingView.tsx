"use client";

import { useState } from "react";
import Link from "next/link";
import { HeroBackground } from "@/components/public/HeroBackground";
import { Eyebrow } from "@/components/marketing/ui";
import { EnterpriseModal } from "@/components/marketing/EnterpriseModal";

const inr = (n: number) => n.toLocaleString("en-IN");
type Cycle = "monthly" | "yearly";

interface Feature {
  label: string;
  included: boolean;
  sub?: string;
}
interface Plan {
  key: "starter" | "pro" | "max" | "enterprise";
  name: string;
  tagline: string;
  monthly?: number; // rupees
  yearly?: number; // rupees (annual total)
  yearlyEquiv?: number; // per-month equivalent when billed yearly
  yearlySave?: number;
  freeForever?: boolean;
  contact?: boolean;
  subLabel?: string;
  seats?: string;
  features: Feature[];
  ctaLabel: string;
  extraSeatNote?: string;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For solo astrologers just getting started.",
    freeForever: true,
    subLabel: "No credit card required",
    features: [
      { label: "Your branded public booking page", included: true },
      { label: "Up to 3 active packages", included: true },
      { label: "UPI QR + manual payment proof", included: true },
      { label: "Booking confirmation emails", included: true },
      { label: "Basic profile (bio, photo, specialities)", included: true },
      { label: "Up to 30 bookings/month", included: true },
      { label: "Custom branding & theme colors", included: false },
      { label: "Your own payment gateway", included: false },
      { label: "AI profile & package setup", included: false },
      { label: "Team members", included: false },
      { label: "Google Calendar sync", included: false },
      { label: "Analytics & charts", included: false },
    ],
    ctaLabel: "Start free →",
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For active practitioners who are serious about their practice.",
    monthly: 799,
    yearly: 7999,
    yearlyEquiv: 666,
    yearlySave: 1589,
    seats: "1 owner + 1 team seat included",
    features: [
      { label: "Everything in Starter", included: true },
      { label: "Unlimited active packages", included: true },
      { label: "Unlimited bookings", included: true },
      { label: "Full custom branding", included: true, sub: "logo, theme colors, font, celestial background elements" },
      { label: "Your own Razorpay gateway", included: true, sub: "money goes directly to your bank" },
      { label: "AI-assisted profile & package setup ✨", included: true },
      { label: "Google Calendar sync", included: true },
      { label: "Auto-generated Google Meet links", included: true },
      { label: "Basic analytics (bookings & earnings)", included: true },
      { label: "PDF receipts with your GST number", included: true },
      { label: "1 additional team member included", included: true },
      { label: "Round-robin scheduling", included: false },
      { label: "Accounts role (financial team member)", included: false },
      { label: "Advanced analytics & charts", included: false },
      { label: "Priority support", included: false },
    ],
    ctaLabel: "Start Pro →",
    extraSeatNote: "+ ₹299/seat/month for additional members",
  },
  {
    key: "max",
    name: "Max",
    tagline: "For growing practices with a team.",
    monthly: 1999,
    yearly: 19999,
    yearlyEquiv: 1666,
    yearlySave: 3989,
    seats: "1 owner + 3 team seats included",
    featured: true,
    features: [
      { label: "Everything in Pro", included: true },
      { label: "3 additional team members", included: true, sub: "Consulting + Accounts roles, any mix" },
      { label: "Round-robin auto-assignment", included: true, sub: "seekers auto-routed to available team member" },
      { label: "Accounts role", included: true, sub: "financial team member sees revenue only, not seeker data" },
      { label: "Advanced analytics & charts", included: true, sub: "revenue trends, booking performance, package breakdown" },
      { label: "Real-time earnings dashboard", included: true },
      { label: "Seeker intake questions per package", included: true },
      { label: "Date overrides & holiday blocking", included: true },
      { label: "Booking frequency limits", included: true },
      { label: "Priority email support (< 24hr response)", included: true },
      { label: "Early access to new features", included: true },
    ],
    ctaLabel: "Start Max →",
    extraSeatNote: "+ ₹499/seat/month for additional members",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "For astrology institutes, spiritual centres & large practices.",
    contact: true,
    subLabel: "Custom pricing · starts at 10 seats",
    features: [
      { label: "Everything in Max", included: true },
      { label: "Custom seat count", included: true },
      { label: "White-label option", included: true, sub: "remove all platform branding" },
      { label: "Dedicated account manager", included: true },
      { label: "Onboarding & setup assistance", included: true },
      { label: "SLA guarantees (99.9% uptime)", included: true },
      { label: "GST invoice for enterprise billing", included: true },
      { label: "Priority WhatsApp + phone support", included: true },
      { label: "Custom contract terms", included: true },
      { label: "Volume pricing", included: true },
    ],
    ctaLabel: "Contact us →",
  },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Do you take a cut of my consultation fees?", a: "Never. We charge only a flat subscription. Every rupee a seeker pays goes directly to your own UPI ID or Razorpay account — we never touch your money. That's the whole point." },
  { q: "How is this different from Topmate or Astrotalk?", a: "Topmate takes 10-13% of every booking. Astrotalk takes 20-30% from marketplace bookings. We charge a flat subscription regardless of how much you earn. The more you earn, the more you save with us." },
  { q: "How do team seats work?", a: "Pro includes 1 extra seat, Max includes 3. Each seat is one team member — either a Consulting member (takes sessions) or an Accounts member (sees revenue only). Add more seats anytime at ₹299/seat (Pro) or ₹499/seat (Max) per month." },
  { q: "Can I start completely free?", a: "Yes. Starter is free forever — no credit card, no trial period, no expiry. You get a real branded booking page with UPI payments and up to 30 bookings/month. Upgrade when you're ready." },
  { q: "What payment methods can seekers use?", a: "On all plans: UPI QR with payment proof (the consultant verifies manually). On Pro and above: connect your own Razorpay account for instant payment confirmation — funds settle directly to your bank within 2 business days." },
  { q: "Can I cancel anytime?", a: "Absolutely. No lock-ins, no cancellation fees. Cancel from your dashboard anytime — your page returns to the free Starter limits." },
  { q: "Is there a setup fee or onboarding cost?", a: "No. You can set up your page, create packages, and go live in under 30 minutes — completely on your own. Enterprise customers get dedicated onboarding assistance included." },
  { q: "Do you offer a yearly discount?", a: "Yes. Pay yearly and save 17% — that's roughly 2 months free. Pro yearly: ₹7,999 (vs ₹9,588 monthly). Max yearly: ₹19,999 (vs ₹23,988 monthly)." },
];

const COMPARISON = [
  { earned: "₹30,000", loss: "₹3,900", plan: "Pro at ₹799", save: "₹3,101" },
  { earned: "₹75,000", loss: "₹9,750", plan: "Max at ₹1,999", save: "₹7,751" },
  { earned: "₹1,50,000", loss: "₹19,500", plan: "Max at ₹1,999", save: "₹17,501" },
];

function Tick({ included }: { included: boolean }) {
  return (
    <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${included ? "bg-marigold text-night" : "bg-line text-muted"}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden>
        {included ? <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />}
      </svg>
    </span>
  );
}

function PriceBlock({ plan, cycle, dbMonthly }: { plan: Plan; cycle: Cycle; dbMonthly?: number }) {
  const big = "font-display text-[2.8rem] font-medium leading-none text-ink";
  const rupee = <span className="align-top text-[2rem]">₹</span>;
  if (plan.contact) {
    return (
      <div className="mt-3">
        <div className="font-display text-3xl font-medium text-terra">Contact us</div>
        {plan.subLabel && <p className="mt-2 text-xs text-muted">{plan.subLabel}</p>}
      </div>
    );
  }
  if (plan.freeForever) {
    return (
      <div className="mt-3">
        <div className={big}>{rupee}0</div>
        <p className="mt-2 text-xs text-muted">free forever</p>
        {plan.subLabel && <p className="text-xs text-muted">{plan.subLabel}</p>}
      </div>
    );
  }
  const monthly = dbMonthly ?? plan.monthly!;
  if (cycle === "monthly") {
    return (
      <div className="mt-3">
        <div className={big}>{rupee}{inr(monthly)}<span className="text-base font-normal text-muted">/mo</span></div>
        <p className="mt-2 text-xs text-muted">billed monthly</p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <div className="text-sm text-muted line-through">₹{inr(monthly)}/mo</div>
      <div className={`mt-0.5 ${big}`}>{rupee}{inr(plan.yearly!)}<span className="text-base font-normal text-muted">/yr</span></div>
      <p className="mt-2 text-xs text-muted">₹{inr(plan.yearlyEquiv!)}/mo billed yearly</p>
      {plan.yearlySave && <span className="mt-2 inline-block rounded-full bg-green/15 px-2.5 py-0.5 text-xs font-medium text-green">Save ₹{inr(plan.yearlySave)}</span>}
    </div>
  );
}

function PlanCard({ plan, cycle, dbMonthly, onEnterprise }: { plan: Plan; cycle: Cycle; dbMonthly?: number; onEnterprise: () => void }) {
  const border = plan.featured ? "border-marigold shadow-[0_20px_50px_rgba(232,163,61,0.15)]" : plan.contact ? "border-dashed border-marigold/40" : "border-line";
  return (
    <div className={`relative flex flex-col rounded-card border bg-white p-7 ${border} ${plan.featured ? "order-first min-[640px]:order-none" : ""}`}>
      {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-marigold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-night">Most popular</span>}
      <h3 className="font-display text-xl text-ink">{plan.name}</h3>
      <p className="mt-1 min-h-[40px] text-sm text-muted">{plan.tagline}</p>

      <PriceBlock plan={plan} cycle={cycle} dbMonthly={dbMonthly} />
      {plan.seats && <p className="mt-3 text-xs font-medium text-ink">{plan.seats}</p>}

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <Tick included={f.included} />
            <span className={f.included ? "text-ink" : "text-muted"}>{f.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {plan.contact ? (
          <button type="button" onClick={onEnterprise} className="w-full rounded-full border border-line bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:border-marigold">
            {plan.ctaLabel}
          </button>
        ) : (
          <Link href="/signin" className={`block rounded-full px-6 py-3 text-center text-sm font-semibold transition hover:-translate-y-0.5 ${plan.featured ? "bg-marigold text-night" : "border border-marigold bg-white text-terra"}`}>
            {plan.ctaLabel}
          </Link>
        )}
      </div>
      {plan.extraSeatNote && <p className="mt-3 text-center text-xs text-muted">{plan.extraSeatNote}</p>}
    </div>
  );
}

function Pills({ cycle, setCycle }: { cycle: Cycle; setCycle: (c: Cycle) => void }) {
  const base = "rounded-full px-5 py-2 text-sm transition";
  return (
    <div className="inline-flex rounded-full border border-line-dark bg-white/5 p-1">
      <button type="button" onClick={() => setCycle("monthly")} className={`${base} ${cycle === "monthly" ? "bg-marigold font-semibold text-night" : "text-sand/70 hover:text-sand"}`}>Monthly</button>
      <button type="button" onClick={() => setCycle("yearly")} className={`${base} ${cycle === "yearly" ? "bg-marigold font-semibold text-night" : "text-sand/70 hover:text-sand"}`}>
        Yearly <span className={cycle === "yearly" ? "text-night/70" : "text-green"}>Save 17%</span>
      </button>
    </div>
  );
}

export function PricingView({ dbMonthly }: { dbMonthly?: { starter?: number; pro?: number; max?: number } }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);

  const seatLabel = (perMonth: number, perYear: number) => (cycle === "yearly" ? `₹${inr(perYear)}/seat/year` : `₹${inr(perMonth)}/seat/month`);

  return (
    <>
      {/* Hero */}
      <header className="relative overflow-hidden text-sand" style={{ background: "radial-gradient(ellipse at 50% -10%, #26224d 0%, #14122b 55%, #0f0d22 100%)" }}>
        <HeroBackground style="stars_zodiac" tint="#f0c074" />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center sm:py-24">
          <Eyebrow tone="marigold">Simple, honest pricing</Eyebrow>
          <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">Pay for the tool.<br />Keep all your earnings.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-sand/75 sm:text-lg">
            A flat subscription — never a commission cut on your consultations. A consultant earning ₹50,000/month saves ₹6,500 every month vs commission-based platforms. Your income is yours, always.
          </p>
          <div className="mt-8 flex justify-center"><Pills cycle={cycle} setCycle={setCycle} /></div>
          <div className="mx-auto mt-5 max-w-md rounded-card border border-line-dark bg-white/5 px-5 py-3 text-sm">
            <p>₹50,000/month earned → you keep <span className="font-semibold text-green">₹50,000</span></p>
            <p className="text-sand/60">On Topmate: you&apos;d lose <span className="font-semibold text-green">₹6,500</span> every month</p>
          </div>
        </div>
      </header>

      {/* Plans */}
      <section className="bg-sand">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {PLANS.map((p) => (
              <PlanCard key={p.key} plan={p} cycle={cycle} dbMonthly={p.key === "starter" || p.key === "enterprise" ? undefined : dbMonthly?.[p.key]} onEnterprise={() => setEnterpriseOpen(true)} />
            ))}
          </div>

          {/* Extra seats */}
          <div className="mx-auto mt-8 max-w-3xl rounded-card border border-line bg-sand-2/60 p-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-terra/10 text-terra">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-5.6 6.5-5.6s6.5 2 6.5 5.6M16 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <div className="min-w-[180px] flex-1">
                <h4 className="font-display text-lg text-ink">Need extra team seats?</h4>
                <p className="text-sm text-muted">Add consulting or accounts members to your plan anytime.</p>
              </div>
              <div className="text-right text-sm">
                <div className="text-ink">Pro · <span className="font-medium text-terra">{seatLabel(299, 2870)}</span></div>
                <div className="text-ink">Max · <span className="font-medium text-terra">{seatLabel(499, 4790)}</span></div>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">All plans: no commission on your earnings · money goes directly to you · cancel anytime.</p>
        </div>
      </section>

      {/* Comparison strip */}
      <section className="relative overflow-hidden text-sand" style={{ background: "radial-gradient(ellipse at 50% -20%, #26224d 0%, #14122b 60%, #0f0d22 100%)" }}>
        <div className="relative mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-center font-display text-2xl sm:text-3xl">How much do you save vs commission platforms?</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {COMPARISON.map((c) => (
              <div key={c.earned} className="rounded-card border border-line-dark bg-white/5 p-6 text-center">
                <div className="font-display text-xl text-marigold-soft">{c.earned}/month earned</div>
                <div className="mt-4 space-y-1.5 text-sm text-sand/75">
                  <div>Topmate: lose {c.loss}/month</div>
                  <div>Jyoti: {c.plan}/month</div>
                </div>
                <div className="mt-4 font-display text-2xl text-marigold">
                  <span className="text-green">↑</span> You save {c.save}/mo
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-sand-2">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <h2 className="text-center font-display text-3xl text-ink">Pricing questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-card border border-line bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink">
                  {f.q}
                  <span className="shrink-0 text-marigold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <EnterpriseModal open={enterpriseOpen} onClose={() => setEnterpriseOpen(false)} />
    </>
  );
}
