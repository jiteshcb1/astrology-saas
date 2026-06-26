import { roleLabel } from "@/lib/team";

// Visually distinct role badges (SP-5.1): Consulting = indigo, Accounts = terracotta, Owner = indigo outline.
export function RoleBadge({ role }: { role: string }) {
  const cls =
    role === "team_consulting"
      ? "bg-night/10 text-night"
      : role === "team_accounts"
        ? "bg-terra/15 text-terra"
        : "border border-night/25 text-night";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{roleLabel(role)}</span>;
}
