import type { Metadata } from "next";
import { PlatformLegalView } from "@/components/public/PlatformLegalView";

export const metadata: Metadata = { title: "Privacy Policy — Astro Consultancy" };

export default function PlatformPrivacyPage() {
  return <PlatformLegalView docType="privacy" />;
}
