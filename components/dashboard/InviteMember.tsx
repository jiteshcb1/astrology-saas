"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { inviteMemberAction } from "@/app/dashboard/team/actions";
import type { TeamFormState } from "@/lib/team";

const ROLE_OPTIONS = [
  { value: "team_consulting", label: "Consulting", desc: "Runs sessions, manages their own availability, gets assigned bookings." },
  { value: "team_accounts", label: "Accounts", desc: "Views receipts and financial records only — no access to bookings or seeker data." },
];

export function InviteMember({ canInvite, limit, trigger = "button" }: { canInvite: boolean; limit: number; trigger?: "button" | "card" }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("team_consulting");
  const [state, action, pending] = useActionState<TeamFormState, FormData>(inviteMemberAction, {});

  useEffect(() => {
    // Close the panel once the server action reports success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <>
      {trigger === "button" ? (
        <div className="group relative">
          <Button type="button" onClick={() => canInvite && setOpen(true)} disabled={!canInvite}>+ Invite member</Button>
          {!canInvite && (
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden w-60 rounded-control border border-line bg-white px-3 py-2 text-xs text-muted shadow-lg group-hover:block">
              You&apos;ve used all {limit} seat{limit === 1 ? "" : "s"} on your plan. Contact the platform to add more seats.
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => canInvite && setOpen(true)}
          disabled={!canInvite}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white px-6 py-8 text-sm font-medium text-ink transition hover:border-marigold disabled:opacity-60"
        >
          <span className="text-xl text-marigold">+</span> Invite your first team member
        </button>
      )}

      <div onClick={() => setOpen(false)} aria-hidden className={`fixed inset-0 z-40 bg-night/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside aria-hidden={!open} className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg text-ink">Invite member</h2>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-control text-muted transition hover:bg-sand-2/60">✕</button>
        </div>
        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
            <Input name="email" type="email" label="Email" placeholder="name@example.com" required />
            <div>
              <span className="mb-1.5 block text-sm text-muted">Role</span>
              <input type="hidden" name="role" value={role} />
              <div className="space-y-2">
                {ROLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRole(o.value)}
                    className={`block w-full rounded-control border px-4 py-3 text-left transition ${role === o.value ? "border-marigold bg-marigold/5" : "border-line hover:border-marigold/50"}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className={`grid h-4 w-4 place-items-center rounded-full border ${role === o.value ? "border-marigold" : "border-line"}`}>
                        {role === o.value && <span className="h-2 w-2 rounded-full bg-marigold" />}
                      </span>
                      {o.label}
                    </span>
                    <span className="mt-1 block pl-6 text-xs text-muted">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted">Personal message (optional)</span>
              <textarea name="message" rows={3} maxLength={500} className="w-full rounded-control border border-line px-4 py-3 text-sm outline-none transition focus:border-marigold" placeholder="A note to include in the invite email…" />
            </label>
            {state.error && <p className="text-sm text-terra">{state.error}</p>}
          </div>
          <div className="border-t border-line p-5">
            <Button type="submit" loading={pending} loadingLabel="Sending…" className="w-full justify-center">Send invite</Button>
          </div>
        </form>
      </aside>
    </>
  );
}
