// Pure dashboard role policy (SP-5.3). No auth/db imports so it's unit-testable in isolation. Role isolation
// is enforced for real by lib/rbac.ts#requireSection (which calls canSee) on every page/action.

export type DashboardSection =
  | "home"
  | "packages"
  | "bookings_manage"
  | "availability"
  | "team"
  | "settings"
  | "finance"
  | "member_bookings"
  | "account"
  | "calendar";

const SECTION_ROLES: Record<DashboardSection, ReadonlySet<string>> = {
  home: new Set(["consultant", "team_consulting", "team_accounts"]),
  packages: new Set(["consultant"]),
  bookings_manage: new Set(["consultant"]),
  availability: new Set(["consultant", "team_consulting"]),
  team: new Set(["consultant"]),
  settings: new Set(["consultant"]),
  finance: new Set(["consultant", "team_accounts"]),
  member_bookings: new Set(["team_consulting"]),
  account: new Set(["team_consulting", "team_accounts"]),
  // T-1.1: each member connects their OWN Google Calendar (owner + consulting partners take calls).
  calendar: new Set(["consultant", "team_consulting"]),
};

/** Pure policy: may this role see this dashboard section? */
export function canSee(role: string | null | undefined, section: DashboardSection): boolean {
  return Boolean(role && SECTION_ROLES[section].has(role));
}

/** Which home `/dashboard` renders for a role. */
export function dashboardHomeKind(role?: string | null): "owner" | "consulting" | "accounts" {
  if (role === "team_consulting") return "consulting";
  if (role === "team_accounts") return "accounts";
  return "owner"; // consultant (owner)
}
