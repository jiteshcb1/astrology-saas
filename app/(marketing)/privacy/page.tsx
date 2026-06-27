import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — Jyoti",
  description: "Placeholder Privacy Policy for the Jyoti platform — illustrative structure only.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "collect",
    heading: "What we collect",
    content: (
      <>
        <p>To provide the service, we may collect: account details (name, email, phone), profile content you add, booking information, and basic usage and device data for security and analytics.</p>
        <p>For seekers booking a consultation, we process the details needed to confirm and deliver that booking, including any questions a consultant asks before a session.</p>
      </>
    ),
  },
  {
    id: "use",
    heading: "How we use it",
    content: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>To run your booking page, scheduling, and notifications</li>
        <li>To send transactional emails (one-time codes, receipts, call links)</li>
        <li>To keep the platform secure and improve it over time</li>
      </ul>
    ),
  },
  { id: "payments", heading: "Payments & financial data", content: <p>Jyoti is a software tool, not a payment processor. We do not hold or settle consultation funds — payments flow directly between the seeker and the consultant via the consultant&apos;s own UPI or payment gateway. We store only the minimum needed to show booking and receipt status.</p> },
  { id: "sharing", heading: "Sharing", content: <p>We don&apos;t sell your data. We share information only with service providers needed to run the platform (such as hosting, email delivery, and error monitoring), and where required by law.</p> },
  { id: "rights", heading: "Your rights", content: <p>You may access, correct, or request deletion of your personal data, subject to applicable law. Consultants control the seeker records they create within their own account.</p> },
  { id: "contact", heading: "Contact", content: <p>For privacy questions, contact us at the email shown on our website. (Placeholder — add your real contact and grievance officer details, as required under Indian law, before launch.)</p> },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="June 2026"
      disclaimer="This is sample structure for the design mockup only — not a legal document. Have a qualified lawyer draft your actual Privacy Policy before launch, especially given India's DPDP Act and payment-data handling."
      sections={SECTIONS}
    />
  );
}
