import type { Metadata } from "next";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "About — Jyoti",
  description: "Jyoti gives India's astrologers and spiritual consultants a beautiful, trustworthy home for their practice — without taking a cut of what they earn.",
};

const VALUES: { icon: string; title: string; body: string }[] = [
  { icon: "M12 2l2.4 6.9H22l-5.8 4.3 2.2 7-6.4-4.6L5.6 20l2.2-7L2 8.9h7.6z", title: "Your craft first", body: "The tool should disappear so the practitioner can shine." },
  { icon: "M2 7h18a1 1 0 011 1v9a1 1 0 01-1 1H4a2 2 0 01-2-2zM17 13h.01", title: "Your money is yours", body: "We never hold funds or take commission. Ever." },
  { icon: "M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z", title: "Built for India", body: "Indic languages, Devanagari, UPI — designed for here." },
];

export default function AboutPage() {
  return (
    <>
      <CelestialHeader eyebrow={<Eyebrow tone="marigold">Our story</Eyebrow>} title={<>About Jyoti</>} />

      <section className="bg-sand">
        <div className="mx-auto w-full max-w-3xl px-6 py-20">
          <p className="font-display text-xl text-ink sm:text-2xl">
            Jyoti exists to give India&apos;s astrologers and spiritual consultants a beautiful, trustworthy home for their practice online — without ever taking a cut of what they earn.
          </p>

          <h2 className="mt-12 font-display text-2xl text-ink">Why we built this</h2>
          <p className="mt-3 text-muted">
            Across India, gifted astrologers, palmists, and numerologists run thriving practices — but on tools never made for them. Bookings live in WhatsApp, payments in screenshots, schedules in memory. It works, but it&apos;s fragile, and it doesn&apos;t reflect the depth of their craft.
          </p>
          <p className="mt-3 text-muted">
            We wanted to change that with something calm, professional, and deeply respectful of both the consultant and the seeker — in their own language, in their own style.
          </p>

          <h2 className="mt-12 font-display text-2xl text-ink">What we believe</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-card border border-line bg-white p-5">
                <span className="grid h-10 w-10 place-items-center rounded-control bg-terra/10 text-terra">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d={v.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <h4 className="mt-3 font-display text-base text-ink">{v.title}</h4>
                <p className="mt-1 text-sm text-muted">{v.body}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-display text-2xl text-ink">Where we&apos;re headed</h2>
          <p className="mt-3 text-muted">
            We&apos;re just getting started. Our aim is to become the most loved, most trusted platform for spiritual consultants across India — and to keep every promise we make about respect, privacy, and fairness along the way.
          </p>
          <p className="mt-6 text-sm text-muted">Jyoti is built by HiFi AI.</p>
        </div>
      </section>
    </>
  );
}
