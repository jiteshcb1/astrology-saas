"use client";

import { useState, type ReactNode } from "react";

// Two-click delete: first click reveals an inline "Confirm / Cancel". On confirm, submits a form to
// the provided server action (hidden inputs passed as children carry the id, etc.). Danger-styled.
export function ConfirmDeleteButton({
  action,
  label = "Delete",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
  children?: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-control border border-terra/50 px-3 py-2 text-sm text-terra transition hover:bg-terra hover:text-white"
      >
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      {children}
      <span className="text-sm text-muted">Sure?</span>
      <button
        type="submit"
        className="rounded-control bg-terra px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Confirm delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-control border border-line px-3 py-2 text-sm text-ink transition hover:border-marigold"
      >
        Cancel
      </button>
    </form>
  );
}
