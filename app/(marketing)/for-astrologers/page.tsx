import type { Metadata } from "next";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow, CtaLink, CtaBand } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "For Astrologers — Jyoti",
  description: "Whether you read kundalis, palms, tarot, or numbers — Jyoti gives your practice a professional home online.",
};

const CARDS: { icon: string; title: string; body: string; cta: { href: string; label: string } }[] = [
  { icon: "M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z", title: "Get started", body: "Sign up free, build your page, and share your link — usually in under an hour, with no technical skills.", cta: { href: "/signin", label: "Start your page →" } },
  { icon: "M3 5h18v14H3zM3 9h18", title: "See it in action", body: "See how other consultants set up their packages, branding, and booking flow for inspiration.", cta: { href: "/features", label: "Explore features →" } },
  { icon: "M12 17h.01M12 13a2.5 2.5 0 10-2.5-2.5M12 21a9 9 0 110-18 9 9 0 010 18z", title: "Support", body: "Questions in Hindi, English, or Hinglish? We're here to help you get set up and growing.", cta: { href: "/about", label: "About us →" } },
];

const EXAMPLES: { initial: string; grad: string; name: string; speciality: string; services: { name: string; price: string }[] }[] = [
  { initial: "R", grad: "linear-gradient(150deg, #3a2c63, #b9543a)", name: "Pandit Ravi Sharma", speciality: "Vedic Astrology · 18 yrs", services: [{ name: "Kundali Reading", price: "₹1,100" }, { name: "Career & Finance", price: "₹751" }, { name: "Quick Question", price: "₹351" }] },
  { initial: "M", grad: "linear-gradient(150deg, #2c4763, #3a6ea5)", name: "Meher Jyotish", speciality: "Palmistry & Tarot · 9 yrs", services: [{ name: "Palm Reading", price: "₹899" }, { name: "Tarot Guidance", price: "₹599" }, { name: "Yes/No Question", price: "₹251" }] },
  { initial: "S", grad: "linear-gradient(150deg, #3a2c63, #7d4f9d)", name: "Acharya Suresh", speciality: "Numerology · 22 yrs", services: [{ name: "Name Correction", price: "₹1,500" }, { name: "Business Numbers", price: "₹2,100" }, { name: "Lucky Number", price: "₹451" }] },
];

export default function ForAstrologersPage() {
  return (
    <>
      <CelestialHeader
        eyebrow={<Eyebrow tone="marigold">For astrologers</Eyebrow>}
        title={<>Built for your craft</>}
        subtitle="Whether you read kundalis, palms, tarot, or numbers — Jyoti gives your practice a professional home online. Vedic astrology, Tarot, Numerology, Palmistry, and Vastu, all supported."
      />

      <section className="bg-sand">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {CARDS.map((c) => (
              <div key={c.title} className="rounded-card border border-line bg-white p-6">
                <span className="grid h-11 w-11 place-items-center rounded-control bg-terra/10 text-terra">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d={c.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h3 className="mt-4 font-display text-lg text-ink">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{c.body}</p>
                <a href={c.cta.href} className="mt-4 inline-block text-sm font-medium text-terra hover:underline">{c.cta.label}</a>
              </div>
            ))}
          </div>

          {/* Own-your-clients angle */}
          <div className="mt-14 rounded-card border border-line bg-sand-2 px-6 py-10 text-center">
            <p className="mx-auto max-w-2xl font-display text-xl italic text-ink sm:text-2xl">
              &ldquo;Earlier I managed everything on WhatsApp — payments, timings, follow-ups. Now my seekers just book, pay, and join. It feels like I finally run a real practice.&rdquo;
            </p>
            <p className="mt-3 text-sm text-muted">— A Vedic astrologer in Jaipur (illustrative)</p>
          </div>

          <div className="mt-14 rounded-card border border-marigold/30 bg-marigold/5 p-6">
            <h3 className="font-display text-lg text-ink">Own your clients — not a marketplace</h3>
            <p className="mt-1.5 text-sm text-muted">Jyoti is a tool, never a marketplace. We never take a commission and never sit between you and your seekers. Your clients, your relationships, and every rupee — all yours. Ask the birth details and intake questions you need before each session.</p>
          </div>
        </div>
      </section>

      {/* Example pages */}
      <section className="bg-sand-2" id="examples">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <h2 className="text-center font-display text-2xl text-ink sm:text-3xl">Example consultant pages</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {EXAMPLES.map((e) => (
              <div key={e.name} className="overflow-hidden rounded-card border border-line bg-white">
                <div className="flex items-center gap-3 p-5 text-sand" style={{ background: e.grad }}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20 font-logo text-lg">{e.initial}</span>
                  <div>
                    <div className="font-display leading-tight">{e.name}</div>
                    <div className="text-xs text-sand/80">{e.speciality}</div>
                  </div>
                </div>
                <div className="p-5">
                  {e.services.map((s, i) => (
                    <div key={s.name} className={`flex items-center justify-between py-2 text-sm ${i > 0 ? "border-t border-line" : ""}`}>
                      <span className="text-ink">{s.name}</span>
                      <span className="font-medium text-terra">{s.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <CtaLink href="/signin" variant="primary">Build your page</CtaLink>
          </div>
        </div>
      </section>

      <CtaBand title="We're here to help you grow" body="Have a question before you start? Reach out — in your language." primary={{ href: "/signin", label: "Start your page" }} secondary={{ href: "/about", label: "About Jyoti" }} />
    </>
  );
}
