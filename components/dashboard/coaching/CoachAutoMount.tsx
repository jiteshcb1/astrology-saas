"use client";

import { usePathname } from "next/navigation";
import { CoachTour } from "./CoachTour";
import type { CoachArea } from "./tours";

// Mounts the right first-run tour for the current dashboard route (so pages don't each wire one in).
// Re-keyed by area so client-side navigation between areas re-evaluates "first visit".
const ROUTES: { match: (p: string) => boolean; area: CoachArea; ownerOnly?: boolean }[] = [
  { match: (p) => p === "/dashboard", area: "dashboard", ownerOnly: true },
  { match: (p) => p.startsWith("/dashboard/settings/profile"), area: "profile" },
  { match: (p) => p.startsWith("/dashboard/packages"), area: "packages" },
  { match: (p) => p.startsWith("/dashboard/availability"), area: "availability" },
  { match: (p) => p.startsWith("/dashboard/settings/payments"), area: "payments" },
  { match: (p) => p.startsWith("/dashboard/bookings"), area: "bookings" },
  { match: (p) => p.startsWith("/dashboard/team"), area: "team" },
];

export function CoachAutoMount({ role }: { role: string }) {
  const pathname = usePathname() ?? "";
  const hit = ROUTES.find((r) => r.match(pathname));
  if (!hit) return null;
  // The dashboard-home tour is owner-centric; team members get their own (none) here.
  if (hit.ownerOnly && role !== "consultant") return null;
  return <CoachTour key={hit.area} area={hit.area} />;
}
