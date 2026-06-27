import type { Metadata } from "next";
import { LegalDoc, Highlight, type LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service — Jyoti",
  description: "Placeholder Terms of Service for the Jyoti platform — illustrative structure only.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "role",
    heading: "Our role",
    content: (
      <>
        <p>Jyoti provides software that lets consultants create booking pages, schedule sessions, and manage their practice. We are a tool — not a party to any consultation or transaction between a consultant and a seeker.</p>
        <Highlight><strong>Platform, not marketplace:</strong> Jyoti never collects, holds, or settles consultation payments. All payments flow directly between the seeker and the consultant through the consultant&apos;s own payment method.</Highlight>
      </>
    ),
  },
  { id: "accounts", heading: "Accounts", content: <p>You&apos;re responsible for the accuracy of your account information and for keeping your login secure. Consultants are responsible for the content, pricing, and conduct of their own practice.</p> },
  {
    id: "payments",
    heading: "Payments & consultations",
    content: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Consultants set their own prices and collect payments directly via UPI or their own gateway.</li>
        <li>Receipts are issued by the consultant under their own name and GST.</li>
        <li>Refunds, rescheduling, and service quality are solely between the consultant and the seeker.</li>
        <li>Jyoti charges consultants a subscription fee for use of the software, described on the Pricing page.</li>
      </ul>
    ),
  },
  { id: "conduct", heading: "Acceptable use", content: <p>Don&apos;t use Jyoti for anything unlawful, deceptive, or harmful, and don&apos;t misuse the platform&apos;s technical systems. We may suspend accounts that violate these terms.</p> },
  { id: "liability", heading: "Liability", content: <p>The platform is provided &ldquo;as is.&rdquo; To the extent permitted by law, Jyoti is not liable for the conduct of consultants or seekers, or for the outcomes of any consultation. (Placeholder — your lawyer will draft proper limitation-of-liability language.)</p> },
  { id: "changes", heading: "Changes", content: <p>We may update these terms from time to time. We&apos;ll note the &ldquo;last updated&rdquo; date, and significant changes will be communicated to account holders.</p> },
];

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="June 2026"
      disclaimer="This is sample structure for the design mockup only — not legal advice. Have a qualified lawyer draft your actual Terms before launch, including the platform-vs-marketplace positioning and RBI payment-aggregator considerations."
      sections={SECTIONS}
    />
  );
}
