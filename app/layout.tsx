import type { Metadata } from "next";
import { Fraunces, Inter, Marcellus, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Body / UI text.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Display / headings.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap" });
// Logo wordmark.
const marcellus = Marcellus({
  variable: "--font-marcellus",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
// Hindi (Devanagari) — activated on the homepage when the language toggle is set to हिं.
const notoDeva = Noto_Sans_Devanagari({
  variable: "--font-noto-deva",
  weight: ["400", "500", "600"],
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Astro Consultancy",
  description: "Booking, scheduling & payments for astrology consultants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${marcellus.variable} ${notoDeva.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
