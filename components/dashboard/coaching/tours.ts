// SP-7.1 — first-run guided onboarding (coach marks). Each tour is shown once per area, then never again
// (persisted in User.coachingSeen). Steps with a `target` spotlight an element marked `data-coach="<key>"`;
// steps without one render a centered card. Themed to the warm dashboard (handled in CoachTour).

export type CoachPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface CoachStep {
  target?: string; // data-coach key to spotlight; omitted → centered card
  title: string;
  body: string;
  placement?: CoachPlacement;
}

// Area keys double as the persistence keys in User.coachingSeen.
export type CoachArea = "dashboard" | "profile" | "packages" | "availability" | "payments" | "bookings" | "team";

export const TOURS: Record<CoachArea, CoachStep[]> = {
  dashboard: [
    { title: "Welcome to your practice 🌟", body: "This is your dashboard — your scheduling, payments, clients and earnings, all in one place.", placement: "center" },
    { target: "nav", title: "Everything lives here", body: "Your page, packages, availability, bookings and earnings are one click away on the left.", placement: "right" },
    { target: "checklist", title: "Start here", body: "Finish these quick steps to go live and take your first booking.", placement: "left" },
    { target: "share", title: "Preview & share your page", body: "See exactly what seekers will see, then share your link on WhatsApp or Instagram.", placement: "top" },
  ],
  profile: [
    { title: "Tell seekers who you are", body: "Add your photo, bio and specialities so seekers know they're in good hands.", placement: "center" },
    { target: "ai-profile", title: "Let AI draft it ✨", body: "Not sure what to write? Generate a first draft with AI, then make it yours.", placement: "bottom" },
  ],
  packages: [
    { title: "Packages are what seekers book", body: "Each package is a service — like a 30-minute Kundali reading — with its own duration and price.", placement: "center" },
    { target: "packages-new", title: "Create your first package", body: "Give it a name, duration and price. AI can write the description for you.", placement: "bottom" },
  ],
  availability: [
    { title: "Set when you're available", body: "Seekers can only book the times you open here — no double-bookings, ever. Connect Google Calendar to block your existing events automatically.", placement: "center" },
  ],
  payments: [
    { title: "Choose how seekers pay you", body: "Money comes straight to YOU — we never touch it. Use a UPI QR with proof, or connect your own Razorpay for instant confirmation.", placement: "center" },
  ],
  bookings: [
    { title: "Your bookings live here", body: "When a seeker books, you'll see their details and a join link right here. It's quiet until your first booking — share your page to get going.", placement: "center" },
  ],
  team: [
    { title: "Working with associates?", body: "Invite consulting or accounts helpers and bookings auto-distribute across your team. Team members need a paid plan — Starter is solo.", placement: "center" },
  ],
};
