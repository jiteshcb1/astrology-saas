import type { Metadata } from "next";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow, CtaBand } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "How it works — Jyoti",
  description: "From sign-up to your first paid consultation — how astrologers go live on Jyoti, usually in under an hour.",
};

const STEPS: { title: string; body: string; bullets: string[] }[] = [
  {
    title: "Create your account",
    body: "Sign up in seconds with Google, or with your email and a one-time code. No passwords to remember, no credit card to start.",
    bullets: ["Continue with Google, or email + OTP", "Pick your unique link, like jyoti.app/ravi-sharma", "Set your timezone — we handle the rest"],
  },
  {
    title: "Make the page yours",
    body: "Tell seekers who you are, and make the page feel like your practice — not like a generic tool.",
    bullets: ["Add your photo, story, experience, and social links", "Upload your logo and pick your theme colour", "Choose Hindi, English, or Hinglish — and an Indic font"],
  },
  {
    title: "Set your offerings & hours",
    body: "Create consultation packages with your own prices, and decide when you're available. Two seekers can never grab the same slot.",
    bullets: ["Packages with durations, prices, discounts & coupons", "Weekly hours, buffers, notice periods, daily limits", "Ask seekers required questions before they book"],
  },
  {
    title: "Choose how you get paid",
    body: "Your money, your account. Jyoti never holds a single rupee — payments flow straight to you.",
    bullets: ["Upload a UPI QR — seekers pay and add proof", "Or connect your own gateway for instant confirmation", "Receipts issued under your name & GST"],
  },
  {
    title: "Share & start consulting",
    body: "Drop your link wherever your seekers already find you. Bookings, reminders, and receipts run themselves.",
    bullets: ["Share on Instagram, YouTube, or WhatsApp", "Seekers book, pay, and get a Google Meet link", "Add a team later — calls auto-share across them"],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <CelestialHeader
        eyebrow={<Eyebrow tone="marigold">The journey</Eyebrow>}
        title={<>From sign-up to your first paid consultation</>}
        subtitle="No technical skills needed. Here's exactly how astrologers go live on Jyoti — usually in well under an hour."
      />

      <section className="bg-sand">
        <div className="mx-auto w-full max-w-3xl px-6 py-20">
          <ol className="space-y-12">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[auto_1fr] gap-5">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-card border-2 border-marigold font-display text-2xl text-marigold">{i + 1}</span>
                <div>
                  <h2 className="font-display text-2xl text-ink">{s.title}</h2>
                  <p className="mt-2 text-muted">{s.body}</p>
                  <ul className="mt-4 space-y-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a33d" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand title="Ready to see it in action?" body="Create your branded booking page and take your first booking — no commission, ever." primary={{ href: "/signin", label: "Start your page" }} secondary={{ href: "/pricing", label: "See pricing" }} />
    </>
  );
}
