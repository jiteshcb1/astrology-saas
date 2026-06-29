"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";

/**
 * From/To date pickers for the receipts GET filter form. Renders the shared DatePicker (controlled)
 * plus hidden inputs (name="from"/"to") so the surrounding server `<form method="GET">` still submits
 * the same query params — only the widget changes from a native <input type="date">.
 */
export function ReceiptDateFilters({ from, to }: { from?: string; to?: string }) {
  const [fromV, setFromV] = useState(from ?? "");
  const [toV, setToV] = useState(to ?? "");
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1.5 block text-muted">From</span>
        <input type="hidden" name="from" value={fromV} />
        <DatePicker value={fromV} onChange={setFromV} max={toV || undefined} clearable size="sm" placeholder="Any date" ariaLabel="From date" />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block text-muted">To</span>
        <input type="hidden" name="to" value={toV} />
        <DatePicker value={toV} onChange={setToV} min={fromV || undefined} clearable size="sm" placeholder="Any date" ariaLabel="To date" />
      </label>
    </>
  );
}
