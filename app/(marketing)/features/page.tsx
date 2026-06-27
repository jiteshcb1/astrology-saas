import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CelestialHeader } from "@/components/marketing/CelestialHeader";
import { Eyebrow, CtaBand } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "Features — Jyoti",
  description: "Scheduling, payments, teams, and seeker records in one calm place — built for Indian astrology consultants.",
};

function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const ICONS = {
  calendar: "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4",
  wallet: "M2 7h18a1 1 0 011 1v9a1 1 0 01-1 1H4a2 2 0 01-2-2zM2 7l2-3h13l1 3M17 13h.01",
  team: "M9 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 3-5 7-5s7 2 7 5M17 9l2 2 3-3",
  notes: "M5 3h11l3 3v15H5zM9 9h7M9 13h7M9 17h4",
  brand: "M12 2l2.4 6.9H22l-5.8 4.3 2.2 7-6.4-4.6L5.6 20l2.2-7L2 8.9h7.6z",
};

type Row = { label: string; value: string; accent?: boolean };
function VisualCard({ icon, heading, rows, devanagari }: { icon: ReactNode; heading: string; rows: Row[]; devanagari?: string }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line-dark p-6" style={{ background: "#14122b" }}>
      <div className="mx-auto w-full max-w-xs rounded-card border border-line-dark bg-night-2 p-5 text-sand">
        <span className="text-marigold">{icon}</span>
        <h3 className="mt-3 font-display text-lg">{heading}</h3>
        {devanagari && <p className="mt-1 text-sm text-sand/70" lang="hi">{devanagari}</p>}
        <div className="mt-3">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex items-center justify-between py-2 text-sm ${i > 0 ? "border-t border-line-dark" : ""}`}>
              <span className="text-sand/75">{r.label}</span>
              <span className={r.accent ? "text-marigold-soft" : "text-sand/55"}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureBlock({ tag, title, body, bullets, visual, flip }: { tag: string; title: string; body: string; bullets: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={flip ? "lg:order-2" : ""}>
        <span className="text-xs font-semibold uppercase tracking-wide text-terra">{tag}</span>
        <h2 className="mt-2 font-display text-2xl text-ink sm:text-3xl">{title}</h2>
        <p className="mt-3 text-muted">{body}</p>
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e8a33d" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <CelestialHeader
        eyebrow={<Eyebrow tone="marigold">Everything you need</Eyebrow>}
        title={<>Powerful tools, gently designed</>}
        subtitle="Jyoti brings scheduling, payments, teams, and seeker records into one calm, beautiful place — built for Indian consultants."
      />

      <section className="bg-sand">
        <div className="mx-auto w-full max-w-5xl space-y-20 px-6 py-20">
          <FeatureBlock
            tag="Scheduling" title="A calendar that never lets you down"
            body="Set your hours once. Seekers see only your free slots, in their own timezone, and a Google Meet link appears automatically on every booking."
            bullets={["Weekly hours, multiple slots per day, date overrides", "Buffers, minimum notice, and daily limits", "Double-bookings are impossible, by design"]}
            visual={<VisualCard icon={<Icon d={ICONS.calendar} />} heading="Mon, 22 June" rows={[{ label: "9:00 AM", value: "Open", accent: true }, { label: "10:30 AM", value: "Open", accent: true }, { label: "12:00 PM", value: "Booked" }]} />}
          />
          <FeatureBlock
            flip tag="Payments" title="Your money goes straight to you"
            body="Jyoti is a tool, not a middleman. We never hold your funds. Take payments by UPI QR, or connect your own gateway for instant confirmation."
            bullets={["UPI QR with payment proof, or your own gateway", "Receipts under your name and GST", "Discounts and coupons, fully your call"]}
            visual={<VisualCard icon={<Icon d={ICONS.wallet} />} heading="Today's earnings" rows={[{ label: "Kundali Reading", value: "₹1,100", accent: true }, { label: "Career & Finance", value: "₹676", accent: true }, { label: "To your bank", value: "Direct ✓" }]} />}
          />
          <FeatureBlock
            tag="Teams" title="Grow with helpers, fairly"
            body="Add team members in two clear roles. Calls share out automatically across your consultants — no manual juggling, no favouritism."
            bullets={["Consulting role — takes calls on your behalf", "Accounts role — manages payments & receipts", "Round-robin assignment, paid simply per seat"]}
            visual={<VisualCard icon={<Icon d={ICONS.team} />} heading="This month" rows={[{ label: "You", value: "27 calls" }, { label: "Amit", value: "15 calls" }, { label: "Shared", value: "Automatically", accent: true }]} />}
          />
          <FeatureBlock
            flip tag="Seeker records" title="Remember every soul you guide"
            body="Keep private reading notes and upload the charts you prepare. Share a secure link with a seeker, or print a clean PDF — all in your branding."
            bullets={["Reading notes & booking history per seeker", "Upload your own chart files (image or PDF)", "Private share links & PDF export"]}
            visual={<VisualCard icon={<Icon d={ICONS.notes} />} heading="Meena Kapoor" rows={[{ label: "Consultations", value: "3" }, { label: "Notes", value: "2 entries" }, { label: "Charts", value: "1 file", accent: true }]} />}
          />
          <FeatureBlock
            tag="Your brand & language" title="It looks like you — not like us"
            body="Seekers see your logo, your colours, your font, and your language. Jyoti stays invisible. Hindi, English, or Hinglish, in beautiful Devanagari."
            bullets={["Logo, theme colour, and Indic fonts", "Hindi / English / Hinglish, switchable by seekers", "A complaints contact, shown clearly for trust"]}
            visual={<VisualCard icon={<Icon d={ICONS.brand} />} heading="Pandit Ravi Sharma" devanagari="वैदिक ज्योतिषी · 18 वर्ष" rows={[{ label: "Theme", value: "Indigo + Gold", accent: true }, { label: "Language", value: "Hinglish" }, { label: "Font", value: "Fraunces" }]} />}
          />
        </div>
      </section>

      <CtaBand title="Everything, working together" body="Create your page and see it all come together — branded, bookable, and yours." primary={{ href: "/signin", label: "Start your page" }} secondary={{ href: "/how-it-works", label: "How it works" }} />
    </>
  );
}
