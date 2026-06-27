import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HeroBackground } from "@/components/public/HeroBackground";
import { Eyebrow, CtaLink } from "@/components/marketing/ui";
import { LeadForm } from "@/components/marketing/LeadForm";

export const metadata: Metadata = {
  title: "Jyoti — Your astrology practice, online",
  description: "A branded booking home for astrology consultants: scheduling, your own payments, teams, and seeker records — you keep every rupee.",
};

const DARK_GRADIENT = "radial-gradient(ellipse at 50% -10%, #26224d 0%, #14122b 55%, #0f0d22 100%)";

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const ICONS = {
  calendar: "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4",
  wallet: "M2 7h18a1 1 0 011 1v9a1 1 0 01-1 1H4a2 2 0 01-2-2zM2 7l2-3h13l1 3M17 13h.01",
  team: "M9 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 9l2 2 3-3",
  notes: "M5 3h11l3 3v15H5zM9 9h7M9 13h7M9 17h4",
};

function ProfilePreview() {
  const services = [
    { name: "Kundali Reading", price: "₹1,100" },
    { name: "Career & Finance", price: "₹751" },
    { name: "Quick Question", price: "₹351" },
  ];
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-card border border-line-dark bg-white shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3 p-5" style={{ background: "linear-gradient(150deg, #3a2c63, #b9543a)" }}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-marigold font-logo text-lg text-night">R</span>
        <div className="text-sand">
          <div className="font-display text-lg leading-tight">Pandit Ravi Sharma</div>
          <div className="text-xs text-sand/80">Vedic Astrology · 18 yrs</div>
        </div>
      </div>
      <div className="p-5">
        {services.map((s, i) => (
          <div key={s.name} className={`flex items-center justify-between py-2.5 text-sm ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="text-ink">{s.name}</span>
            <span className="font-medium text-terra">{s.price}</span>
          </div>
        ))}
        <div className="mt-4 rounded-full bg-marigold py-2.5 text-center text-sm font-semibold text-night">Book a session</div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-line-dark px-5 py-4 text-center transition hover:-translate-y-1 hover:border-marigold/50">
      <div className="font-display text-3xl text-marigold-soft">{value}</div>
      <div className="mt-1 text-xs text-sand/65">{label}</div>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-marigold font-logo text-lg text-terra">{n}</span>
      <div>
        <h3 className="font-display text-lg text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-6 transition hover:-translate-y-1 hover:border-marigold/50 hover:shadow-[0_18px_40px_rgba(20,18,43,0.08)]">
      <span className="grid h-11 w-11 place-items-center rounded-control bg-marigold/12 text-terra">{icon}</span>
      <h3 className="mt-4 font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden text-sand" style={{ background: DARK_GRADIENT }}>
        <HeroBackground style="stars_zodiac" tint="#f0c074" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <Eyebrow tone="marigold">✦ For astrologers, palmists &amp; Vedic consultants</Eyebrow>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Your practice, beautifully <em className="text-marigold not-italic">online</em>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-sand/75 sm:text-lg">
              A branded booking home for your consultations — schedule calls, take payments your way, and guide your seekers. You keep every rupee; we just power the experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/signin" variant="primary">Start your page</CtaLink>
              <CtaLink href="/demo" variant="ghost-light">Try the demo</CtaLink>
            </div>
            <p className="mt-5 text-xs text-sand/55">No commission on your earnings · No signup to explore the demo</p>
          </div>
          <ProfilePreview />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value="100%" label="your earnings" />
          <Stat value="3" label="languages & scripts" />
          <Stat value="0" label="double-bookings" />
          <Stat value="∞" label="your branding" />
        </div>
      </section>

      {/* Book a free demo (lead capture) */}
      <section id="get-started" className="bg-sand scroll-mt-20">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <Eyebrow>Book a free demo</Eyebrow>
            <h2 className="mt-4 font-display text-3xl text-ink sm:text-4xl">See your astrology page, live</h2>
            <p className="mt-3 text-muted">Leave your details and we&apos;ll set up a quick 15-minute walkthrough on WhatsApp — in Hindi, English, or Hinglish. No commitment, no commission, ever.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink">
              {["A live tour of your branded booking page", "Help choosing UPI QR vs. your own gateway", "Answers to every question, in your language"].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a33d" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <LeadForm />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-sand">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center">
          <Eyebrow>The path</Eyebrow>
          <h2 className="mt-4 font-display text-3xl text-ink sm:text-4xl">Three steps to your own consulting page</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">No tech skills needed. Bring your craft; we handle the rest.</p>
          <div className="mt-12 grid gap-8 text-left sm:grid-cols-3">
            <StepCard n={1} title="Make it yours" body="Add your photo, story, colours, font, and language — Hindi, English, or Hinglish." />
            <StepCard n={2} title="Set your offerings" body="Packages, prices, durations, and availability — with clash prevention built in." />
            <StepCard n={3} title="Share & consult" body="Share your link on Instagram or WhatsApp; bookings, receipts, and call links run themselves." />
          </div>
        </div>
      </section>

      {/* Features teaser */}
      <section className="bg-sand-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="text-center">
            <Eyebrow>Everything in one place</Eyebrow>
            <h2 className="mt-4 font-display text-3xl text-ink sm:text-4xl">Built for the way you already work</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<Icon d={ICONS.calendar} />} title="Smart scheduling" body="Availability, buffers, and limits — calls land on your calendar with a Meet link, and double-bookings can't happen." />
            <FeatureCard icon={<Icon d={ICONS.wallet} />} title="Your own payments" body="UPI QR or your own gateway. Money reaches your account directly — never ours." />
            <FeatureCard icon={<Icon d={ICONS.team} />} title="Bring your team" body="Add helpers to take calls or manage accounts. Bookings share out fairly and automatically." />
            <FeatureCard icon={<Icon d={ICONS.notes} />} title="Seeker records" body="Keep reading notes and upload charts for each client. Share a private link or a clean PDF." />
          </div>
          <div className="mt-10 text-center">
            <CtaLink href="/features" variant="ghost-dark">Explore all features</CtaLink>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden text-sand" style={{ background: "radial-gradient(ellipse at 50% 120%, #2a2552 0%, #0f0d22 100%)" }}>
        <div className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">Ready to build your page?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sand/75">Set up your branded booking home in minutes. No commission, ever — your money goes directly to you.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <CtaLink href="/signin" variant="primary">Start your page</CtaLink>
            <CtaLink href="/pricing" variant="ghost-light">See pricing</CtaLink>
          </div>
        </div>
      </section>
    </>
  );
}
