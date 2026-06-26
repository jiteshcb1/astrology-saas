import { requireOrgOwner } from "@/lib/rbac";
import { listTeam, seatUsage } from "@/lib/team";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { MemberActionsMenu } from "@/components/dashboard/MemberActionsMenu";
import { InviteMember } from "@/components/dashboard/InviteMember";
import { resendInviteAction, cancelInviteAction } from "./actions";

function initial(name?: string | null, email?: string | null): string {
  return ((name?.trim() || email?.trim() || "?")[0] ?? "?").toUpperCase();
}
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function sentAgo(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent 1 day ago";
  return `Sent ${days} days ago`;
}

export default async function TeamPage() {
  const { orgId } = await requireOrgOwner();
  const [team, usage] = await Promise.all([listTeam(orgId), seatUsage(orgId)]);
  const canInvite = usage.remaining > 0;
  const others = team.members.filter((m) => m.userId !== team.ownerUserId);
  const isEmpty = others.length === 0 && team.invites.length === 0;

  return (
    <>
      <PageHeader title="Team" subtitle={`${team.members.length} member${team.members.length === 1 ? "" : "s"} · ${team.invites.length} pending · ${usage.remaining} seat${usage.remaining === 1 ? "" : "s"} left`}>
        <InviteMember canInvite={canInvite} limit={usage.limit} />
      </PageHeader>

      <div className="mx-auto w-full max-w-3xl px-6 py-6">
        {/* Active members */}
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Active members</h2>
        <div className="overflow-hidden rounded-card border border-line bg-white">
          {team.members.map((m, i) => {
            const isOwner = m.userId === team.ownerUserId;
            return (
              <div key={m.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marigold/20 font-display text-sm text-ink">{initial(m.user.name, m.user.email)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{m.user.name || m.user.email || "—"}</div>
                  <div className="truncate text-xs text-muted">{m.user.email}{!isOwner && ` · joined ${fmtDate(m.createdAt)}`}</div>
                </div>
                <RoleBadge role={isOwner ? "consultant" : m.role} />
                {!isOwner && <MemberActionsMenu memberId={m.id} currentRole={m.role} />}
              </div>
            );
          })}
        </div>

        {isEmpty && (
          <div className="mt-4 rounded-card border border-line bg-white">
            <EmptyState
              variant="no_team_yet"
              cta={<div className="mx-auto max-w-xs"><InviteMember canInvite={canInvite} limit={usage.limit} trigger="card" /></div>}
            />
          </div>
        )}

        {/* Pending invites */}
        {team.invites.length > 0 && (
          <>
            <h2 className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-muted">Pending invites</h2>
            <div className="overflow-hidden rounded-card border border-line bg-sand-2/30">
              {team.invites.map((inv, i) => (
                <div key={inv.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{inv.email}</div>
                    <div className="text-xs text-muted">{inv.expired ? "Expired" : sentAgo(inv.createdAt)}</div>
                  </div>
                  <RoleBadge role={inv.role} />
                  <div className="flex items-center gap-2">
                    <form action={resendInviteAction}>
                      <input type="hidden" name="inviteId" value={inv.id} />
                      <button type="submit" className="text-xs font-medium text-terra hover:underline">Resend</button>
                    </form>
                    {!inv.expired && (
                      <form action={cancelInviteAction}>
                        <input type="hidden" name="inviteId" value={inv.id} />
                        <button type="submit" className="text-xs text-muted hover:text-ink hover:underline">Cancel</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
