"use client";

import { useState } from "react";
import { changeRoleAction, removeMemberAction } from "@/app/dashboard/team/actions";

const ROLES: [string, string][] = [
  ["team_consulting", "Consulting"],
  ["team_accounts", "Accounts"],
];

export function MemberActionsMenu({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(false);
    setConfirming(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Member actions"
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-control text-lg leading-none text-muted transition hover:bg-sand-2/60"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden onClick={close} />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-card border border-line bg-white p-2 shadow-xl">
            {!confirming ? (
              <>
                <p className="px-2 pb-1 pt-1 text-xs uppercase tracking-wide text-muted">Change role</p>
                {ROLES.map(([value, label]) => (
                  <form key={value} action={changeRoleAction}>
                    <input type="hidden" name="memberId" value={memberId} />
                    <input type="hidden" name="role" value={value} />
                    <button
                      type="submit"
                      disabled={currentRole === value}
                      className="flex w-full items-center justify-between rounded-control px-2 py-2 text-left text-sm text-ink transition hover:bg-sand-2/50 disabled:cursor-default disabled:opacity-50"
                    >
                      {label}
                      {currentRole === value && <span className="text-xs text-green">current</span>}
                    </button>
                  </form>
                ))}
                <div className="my-1 border-t border-line" />
                <button type="button" onClick={() => setConfirming(true)} className="w-full rounded-control px-2 py-2 text-left text-sm text-terra transition hover:bg-terra/10">
                  Remove member
                </button>
              </>
            ) : (
              <form action={removeMemberAction} className="p-1">
                <input type="hidden" name="memberId" value={memberId} />
                <p className="px-1 pb-2 text-sm text-ink">Remove this member? Any upcoming assigned bookings must be reassigned first.</p>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-control bg-terra px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90">Remove</button>
                  <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
