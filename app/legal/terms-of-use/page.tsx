import type { Metadata } from "next";
import { PlatformLegalView } from "@/components/public/PlatformLegalView";

export const metadata: Metadata = { title: "Terms of Use — Astro Consultancy" };

export default function PlatformTermsOfUsePage() {
  return <PlatformLegalView docType="terms_of_use" />;
}
