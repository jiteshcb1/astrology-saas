"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  exact?: boolean;
}

const I = (path: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
    {path}
  </svg>
);

const NAV: NavItem[] = [
  { href: "/superadmin", label: "Dashboard", exact: true, icon: I(<path d="M3 9l7-6 7 6v8a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1z" strokeLinejoin="round" />) },
  { href: "/superadmin/consultants", label: "Consultants", icon: I(<><circle cx="7" cy="7" r="3" /><path d="M2 17c0-3 2-5 5-5s5 2 5 5M13 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" /></>) },
  { href: "/superadmin/plans", label: "Plans", icon: I(<><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14" strokeLinecap="round" /></>) },
  { href: "/superadmin/flags", label: "Feature Flags", icon: I(<path d="M5 3v14M5 4h9l-2 3 2 3H5" strokeLinecap="round" strokeLinejoin="round" />) },
  { href: "/superadmin/oversight", label: "Oversight", icon: I(<><circle cx="9" cy="9" r="6" /><path d="M9 6v3l2 2" strokeLinecap="round" /></>) },
  { href: "/superadmin/catalogs", label: "Catalogs", icon: I(<><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M3 8h14M8 3v14" strokeLinecap="round" /></>) },
];

export function SuperadminSidebar({ email, role }: { email: string; role: string }) {
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
        Astro Admin
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-control px-3.5 py-2.5 text-[0.92rem] transition ${
                active
                  ? "bg-marigold font-semibold text-night"
                  : "text-sand/70 hover:bg-sand/[0.06] hover:text-sand"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
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
