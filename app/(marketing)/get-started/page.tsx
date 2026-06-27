import type { Metadata } from "next";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow } from "@/components/marketing/ui";
import { LeadForm } from "@/components/marketing/LeadForm";

export const metadata: Metadata = {
  title: "Get started — Jyoti",
  description: "Book a free 15-minute demo and see your astrology booking page live. We'll reach out on WhatsApp within 24 hours.",
};

export default function GetStartedPage() {
  return (
    <>
      <CelestialHeader
        eyebrow={<Eyebrow tone="marigold">Book a free demo</Eyebrow>}
        title={<>Let&apos;s build your page together</>}
        subtitle="Leave your details and we'll set up a quick 15-minute walkthrough on WhatsApp — in Hindi, English, or Hinglish. No commitment, no commission, ever."
      />
      <section className="bg-sand">
        <div className="mx-auto w-full max-w-xl px-6 py-16">
          <LeadForm />
        </div>
      </section>
    </>
  );
}
