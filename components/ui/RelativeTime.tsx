"use client";

import { useEffect, useState } from "react";
import { absoluteIST, formatRelative } from "@/lib/relative-time";

// Live relative timestamp ("3 minutes ago"), refreshing each minute, with the full IST datetime on hover.
// suppressHydrationWarning: the server and first client render can differ by a minute — that's expected.
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const target = new Date(iso);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={absoluteIST(target)} className={className} suppressHydrationWarning>
      {formatRelative(target)}
    </time>
  );
}
