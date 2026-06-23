"use client";

import { signOut } from "next-auth/react";

// Dark-surface sign-out for the sidebar footer (the server-action SignOutForm stays for the
// consultant dashboard). Uses the client signOut so it lives inside the client sidebar.
export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className="mt-1 w-full rounded-control border border-line-dark px-3 py-2 text-sm text-sand/80 transition hover:border-marigold hover:text-sand"
    >
      Sign out
    </button>
  );
}
