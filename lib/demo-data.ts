// Dev-only demo data for the consultant dashboard. Real bookings/payments/seekers arrive in
// SP-3/SP-4/SP-6; until then this populates the dashboard so the design can be reviewed.
// Gated by isDashboardDemo(): ON in dev, OFF in production unless DASHBOARD_DEMO=true.

export function isDashboardDemo(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.DASHBOARD_DEMO === "true";
}

export type DemoTone = "marigold" | "terra" | "green";

export interface DemoConsultation {
  id: string;
  time: string;
  title: string;
  seekerName: string;
  seekerEmail: string;
  packageName: string;
  status: "upcoming" | "confirmed" | "completed";
  meetLink: string;
  upcoming: boolean;
  tone: DemoTone;
}

// Consultation sets placed on days relative to "today" by the calendar.
export const DEMO_TODAY: DemoConsultation[] = [
  { id: "c1", time: "09:00 – 10:00", title: "Kundali Reading", seekerName: "Meena Kapoor", seekerEmail: "meena@example.com", packageName: "Kundali Reading", status: "upcoming", meetLink: "https://meet.google.com/abc-defg-hij", upcoming: true, tone: "marigold" },
  { id: "c2", time: "11:30 – 12:00", title: "Career & Finance", seekerName: "Arjun Singh", seekerEmail: "arjun@example.com", packageName: "Career & Finance", status: "upcoming", meetLink: "https://meet.google.com/klm-nopq-rst", upcoming: true, tone: "terra" },
  { id: "c3", time: "16:00 – 16:45", title: "Marriage Matchmaking", seekerName: "Priya Desai", seekerEmail: "priya@example.com", packageName: "Marriage & Matchmaking", status: "confirmed", meetLink: "https://meet.google.com/uvw-xyza-bcd", upcoming: true, tone: "green" },
];
export const DEMO_NEXT_DAY: DemoConsultation[] = [
  { id: "c4", time: "10:00 – 10:30", title: "Quick Question", seekerName: "Rahul Verma", seekerEmail: "rahul@example.com", packageName: "Quick Question", status: "upcoming", meetLink: "https://meet.google.com/efg-hijk-lmn", upcoming: true, tone: "marigold" },
  { id: "c5", time: "14:00 – 15:00", title: "Vastu Consultation", seekerName: "Sunita Rao", seekerEmail: "sunita@example.com", packageName: "Vastu", status: "upcoming", meetLink: "https://meet.google.com/opq-rstu-vwx", upcoming: true, tone: "terra" },
];
export const DEMO_LATER: DemoConsultation[] = [
  { id: "c6", time: "12:00 – 12:45", title: "Numerology", seekerName: "Karan Mehta", seekerEmail: "karan@example.com", packageName: "Numerology", status: "confirmed", meetLink: "https://meet.google.com/yza-bcde-fgh", upcoming: true, tone: "green" },
];
export const DEMO_PAST: DemoConsultation[] = [
  { id: "c7", time: "15:00 – 15:45", title: "Kundali Reading", seekerName: "Deepa Nair", seekerEmail: "deepa@example.com", packageName: "Kundali Reading", status: "completed", meetLink: "", upcoming: false, tone: "marigold" },
];

export interface DemoMetric {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  tone: DemoTone;
  spark: number[];
}

export const DEMO_METRICS: DemoMetric[] = [
  { key: "revenue", label: "Revenue (this month)", value: "₹38,200", delta: "18.6%", deltaUp: true, tone: "marigold", spark: [12, 14, 13, 17, 16, 19, 18, 22, 21, 24, 23, 26] },
  { key: "bookings", label: "Bookings", value: "42", delta: "12.4%", deltaUp: true, tone: "terra", spark: [4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 11] },
  { key: "seekers", label: "New seekers", value: "28", delta: "7.2%", deltaUp: true, tone: "green", spark: [2, 3, 3, 4, 3, 5, 4, 6, 5, 6, 6, 7] },
  { key: "rating", label: "Avg. rating", value: "4.9", delta: "128 reviews", deltaUp: true, tone: "marigold", spark: [4.5, 4.6, 4.6, 4.7, 4.7, 4.8, 4.8, 4.8, 4.9, 4.9, 4.9, 4.9] },
];

export interface DemoLastConsultation {
  id: string;
  seekerName: string;
  seekerEmail: string;
  packageName: string;
  date: string;
  amount: string;
  status: "completed" | "no_show" | "refunded";
}

export const DEMO_LAST_CONSULTATIONS: DemoLastConsultation[] = [
  { id: "l1", seekerName: "Deepa Nair", seekerEmail: "deepa@example.com", packageName: "Kundali Reading", date: "2 days ago", amount: "₹1,200", status: "completed" },
  { id: "l2", seekerName: "Vikram Joshi", seekerEmail: "vikram@example.com", packageName: "Career & Finance", date: "3 days ago", amount: "₹1,800", status: "completed" },
  { id: "l3", seekerName: "Anita Shah", seekerEmail: "anita@example.com", packageName: "Quick Question", date: "4 days ago", amount: "₹500", status: "no_show" },
  { id: "l4", seekerName: "Ravi Iyer", seekerEmail: "ravi@example.com", packageName: "Marriage & Matchmaking", date: "5 days ago", amount: "₹2,500", status: "completed" },
  { id: "l5", seekerName: "Neha Gupta", seekerEmail: "neha@example.com", packageName: "Vastu", date: "1 week ago", amount: "₹2,000", status: "refunded" },
];

export interface DemoPayment {
  id: string;
  seekerName: string;
  amount: string;
  method: "UPI" | "Gateway";
  status: "success" | "pending_verification" | "refunded";
  date: string;
}

export const DEMO_PAYMENTS: DemoPayment[] = [
  { id: "p1", seekerName: "Deepa Nair", amount: "₹1,200", method: "UPI", status: "success", date: "2 days ago" },
  { id: "p2", seekerName: "Vikram Joshi", amount: "₹1,800", method: "Gateway", status: "success", date: "3 days ago" },
  { id: "p3", seekerName: "Meena Kapoor", amount: "₹1,200", method: "UPI", status: "pending_verification", date: "Today" },
  { id: "p4", seekerName: "Neha Gupta", amount: "₹2,000", method: "Gateway", status: "refunded", date: "1 week ago" },
];

export interface DemoServiceSlice {
  name: string;
  amount: number; // paise
  pct: number;
  tone: DemoTone | "soft";
}

export const DEMO_REVENUE_BY_SERVICE: DemoServiceSlice[] = [
  { name: "Kundali Reading", amount: 1045000, pct: 41, tone: "marigold" },
  { name: "Career & Finance", amount: 675000, pct: 27, tone: "terra" },
  { name: "Matchmaking", amount: 589000, pct: 24, tone: "green" },
  { name: "Muhurat", amount: 180000, pct: 8, tone: "soft" },
];
export const DEMO_REVENUE_TOTAL_PAISE = 2489000;

// Two series for the performance line chart (revenue + expenses-style), in ₹ thousands.
export const DEMO_REVENUE_SERIES = [12, 15, 13, 18, 16, 21, 19, 24, 22, 26, 24, 28];
export const DEMO_EXPENSE_SERIES = [5, 6, 5, 7, 6, 8, 7, 9, 8, 9, 8, 10];
export const DEMO_SERIES_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DemoActivity {
  id: string;
  text: string;
  time: string;
  tone: DemoTone;
}
export const DEMO_RECENT_ACTIVITY: DemoActivity[] = [
  { id: "a1", text: "Meena Kapoor booked a Kundali Reading", time: "10:30 AM", tone: "marigold" },
  { id: "a2", text: "Payment of ₹1,800 received from Vikram Joshi", time: "Yesterday", tone: "green" },
  { id: "a3", text: "Career & Finance call completed with Deepa Nair", time: "Yesterday", tone: "terra" },
  { id: "a4", text: "New seeker Karan Mehta added", time: "2 days ago", tone: "green" },
  { id: "a5", text: "Receipt #RC-1203 sent to Ravi Iyer", time: "3 days ago", tone: "marigold" },
];
