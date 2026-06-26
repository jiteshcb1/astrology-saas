import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";

// SP-5.6 relative timestamps (date-fns for the buckets; Intl for the IST absolute so it's timezone-correct
// regardless of the server's locale). Past-focused: future instants fall back to the absolute date.
const TZ = "Asia/Kolkata";

const absDateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
const absDateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});

export function formatRelative(target: Date, now: Date = new Date()): string {
  const mins = differenceInMinutes(now, target);
  if (mins < 0) return absDateFmt.format(target); // future → just show the date
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = differenceInHours(now, target);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = differenceInDays(now, target);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return absDateFmt.format(target); // "Jun 10, 2026"
}

// Full absolute datetime for the hover tooltip, e.g. "25 Jun 2026, 3:41 pm IST".
export function absoluteIST(target: Date): string {
  return `${absDateTimeFmt.format(target)} IST`;
}
