"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/superadmin/SignOutButton";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
  soon?: boolean;
}

const I = (path: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    {path}
  </svg>
);

// Mirrors docs/mockups/demo-dashboard.html. Home + Settings are live this phase; the rest are
// rendered disabled with a "Soon" pill (no dead routes).
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", exact: true, icon: I(<path d="M3 9l7-6 7 6v8a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1z" strokeLinejoin="round" />) },
  { href: "/dashboard/packages", label: "Packages", icon: I(<><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M3 8h14M8 3v14" strokeLinecap="round" /></>) },
  { href: "/dashboard/bookings", label: "Bookings", icon: I(<><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" /></>) },
  { href: "/dashboard/availability", label: "Availability", icon: I(<><circle cx="10" cy="10" r="8" /><path d="M10 5v5l3 2" strokeLinecap="round" /></>) },
  { href: "#", label: "Payments", soon: true, icon: I(<><rect x="2" y="5" width="16" height="11" rx="2" /><path d="M2 9h16" strokeLinecap="round" /></>) },
  { href: "#", label: "Team", soon: true, icon: I(<><circle cx="7" cy="7" r="3" /><path d="M2 17c0-3 2-5 5-5s5 2 5 5M13 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" /></>) },
  { href: "#", label: "Seekers", soon: true, icon: I(<path d="M4 3h12v14H6l-2 2z" strokeLinejoin="round" />) },
  { href: "/dashboard/settings", label: "Settings", icon: I(<><circle cx="10" cy="10" r="3" /><path d="M10 1v3M10 16v3M1 10h3M16 10h3M4 4l2 2M14 14l2 2M16 4l-2 2M4 16l2-2" strokeLinecap="round" /></>) },
];

export function ConsultantSidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col bg-night px-4 py-6 text-sand md:flex">
      <div className="flex items-center gap-2 px-3 pb-6 font-logo text-xl">
        <span className="text-marigold">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2" strokeLinecap="round" />
          </svg>
        </span>
        Jyoti
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) =>
          item.soon ? (
            <div
              key={item.label}
              className="flex cursor-default items-center gap-3 rounded-control px-3.5 py-2.5 text-[0.92rem] text-sand/40"
            >
              {item.icon}
              {item.label}
              <span className="ml-auto rounded-full bg-sand/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-wide text-sand/50">
                Soon
              </span>
            </div>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-control px-3.5 py-2.5 text-[0.92rem] transition ${
                isActive(item)
                  ? "bg-marigold font-semibold text-night"
                  : "text-sand/70 hover:bg-sand/[0.06] hover:text-sand"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ),
        )}
      </nav>

      <div className="mt-auto border-t border-line-dark pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marigold font-logo text-night">
            {(email[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 text-sm">
            <div className="truncate text-sand">{email || "—"}</div>
            <div className="text-xs text-sand/50">{role}</div>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
