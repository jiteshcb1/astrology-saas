import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Central authorization. This is the ONLY sanctioned access check — do not write ad-hoc
// `if (role === …)` checks in routes/components. `can`/`roleHome` are pure (unit-tested);
// `requireRole` is the authoritative server guard.

export type Action = "access:superadmin" | "access:dashboard";

const DASHBOARD_ROLES = new Set(["consultant", "team_consulting", "team_accounts"]);

/** Pure policy: may an actor with this role perform this action? */
export function can(actor: { role?: string | null } | null | undefined, action: Action): boolean {
  const role = actor?.role;
  if (!role) return false;
  switch (action) {
    case "access:superadmin":
      return role === "super_admin";
    case "access:dashboard":
      return DASHBOARD_ROLES.has(role);
    default:
      return false;
  }
}

/** Post-login destination for a role. */
export function roleHome(role?: string | null): string {
  if (role === "super_admin") return "/superadmin";
  if (role && DASHBOARD_ROLES.has(role)) return "/dashboard";
  return "/";
}

/** Require a signed-in user; redirect to /signin otherwise. Returns the session. */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session;
}

/**
 * Authoritative route guard. Authorizes against the LIVE DB role (not the cached JWT claim),
 * so a role change is enforced on the next request. Authenticated-but-unauthorized ⇒ 404
 * (no existence leak); unauthenticated ⇒ redirect to /signin.
 */
export async function requireRole(action: Action) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || !can(user, action)) notFound();
  return { session, role: user.role };
}
