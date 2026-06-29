// SP — illustrative testimonials for the homepage wall. Data array so real ones can swap in later.
// Quotes stay in English across all languages (names/cities are proper nouns); the heading + footnote translate.
export interface Testimonial {
  name: string;
  specialty: string;
  city: string;
  quote: string;
}

export const TESTIMONIALS: Testimonial[] = [
  { name: "Rakesh Sharma", specialty: "Vedic Astrology", city: "Jaipur", quote: "I used to manage everything on WhatsApp. Now seekers just book, pay, and join — and the receipts go out on their own. It finally feels like a real practice." },
  { name: "Meenakshi Iyer", specialty: "Tarot", city: "Chennai", quote: "No more chasing payments or screenshots. The money lands straight in my account, and my page looks exactly like my brand." },
  { name: "Vikram Joshi", specialty: "Numerology", city: "Pune", quote: "Setting up took twenty minutes. My availability, my prices, my language — and double-bookings simply can't happen anymore." },
  { name: "Sunita Deshpande", specialty: "Vastu", city: "Nagpur", quote: "Clients find me by my own name, not buried in a marketplace. And I keep every rupee I earn." },
  { name: "Anil Kumar", specialty: "Palmistry", city: "Lucknow", quote: "The notes and chart uploads for each seeker are a quiet superpower. I walk into every call already prepared." },
  { name: "Lakshmi Narayanan", specialty: "Prashna", city: "Kochi", quote: "I added a helper for accounts and the bookings just share out fairly. It grows with me instead of holding me back." },
];
