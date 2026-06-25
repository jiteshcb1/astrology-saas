import type { Metadata } from "next";
import { PlatformLegalView } from "@/components/public/PlatformLegalView";

export const metadata: Metadata = { title: "Terms & Conditions — Astro Consultancy" };

export default function PlatformTermsPage() {
  return <PlatformLegalView docType="terms" />;
}
