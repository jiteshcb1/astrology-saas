// Timezone helpers (pure, no dependency). Availability is defined in the consultant's IANA timezone
// as local clock times ("HH:mm"); everything is stored/compared as UTC. These convert at the
// boundary. Uses Intl, which is DST-correct for any IANA zone (Asia/Kolkata is a fixed +05:30).

// Offset (ms) such that wall-clock = utc + offset, for the given instant in `tz`.
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]),
  );
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wallAsUtc - instant.getTime();
}

// The UTC instant for a wall-clock time (dateISO "YYYY-MM-DD" + "HH:mm") in `tz`.
export function zonedClockToUtc(dateISO: string, time: string, tz: string): Date {
  const [y, mo, da] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, hh, mm);
  // First pass: subtract the offset at the guessed instant.
  const offset1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - offset1;
  // Refine once for DST-transition edges (offset can differ at the corrected instant).
  const offset2 = tzOffsetMs(new Date(utc), tz);
  if (offset2 !== offset1) utc = guess - offset2;
  return new Date(utc);
}

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
}

// The wall-clock calendar parts of a UTC instant, as seen in `tz`.
export function utcToZonedParts(instant: Date, tz: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]),
  );
  const year = +p.year;
  const month = +p.month;
  const day = +p.day;
  return {
    year,
    month,
    day,
    hour: +p.hour,
    minute: +p.minute,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

// Weekday (0=Sun … 6=Sat) of a "YYYY-MM-DD" date — calendar-only, tz-independent.
export function weekdayOf(dateISO: string): number {
  const [y, mo, da] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// Iterate "YYYY-MM-DD" calendar dates inclusive (tz-independent date labels).
export function eachDateISO(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  let cur = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cur <= end) {
    const dt = new Date(cur);
    const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    out.push(iso);
    cur += 86_400_000;
  }
  return out;
}
