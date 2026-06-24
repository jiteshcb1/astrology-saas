import { describe, expect, it } from "vitest";
import { addMinutes, eachDateISO, utcToZonedParts, weekdayOf, zonedClockToUtc } from "../lib/timezone";

describe("timezone (pure)", () => {
  it("zonedClockToUtc: Asia/Kolkata is +05:30 (no DST)", () => {
    // 09:00 IST on 2026-07-01 == 03:30 UTC.
    const utc = zonedClockToUtc("2026-07-01", "09:00", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-07-01T03:30:00.000Z");
  });

  it("zonedClockToUtc: handles a DST zone (America/New_York, July = EDT -04:00)", () => {
    // 09:00 EDT on 2026-07-01 == 13:00 UTC.
    const utc = zonedClockToUtc("2026-07-01", "09:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    // 09:00 EST on 2026-01-01 (winter, -05:00) == 14:00 UTC.
    const winter = zonedClockToUtc("2026-01-01", "09:00", "America/New_York");
    expect(winter.toISOString()).toBe("2026-01-01T14:00:00.000Z");
  });

  it("utcToZonedParts: round-trips the wall clock", () => {
    const utc = zonedClockToUtc("2026-07-01", "09:00", "Asia/Kolkata");
    const p = utcToZonedParts(utc, "Asia/Kolkata");
    expect([p.year, p.month, p.day, p.hour, p.minute]).toEqual([2026, 7, 1, 9, 0]);
  });

  it("weekdayOf + eachDateISO", () => {
    expect(weekdayOf("2026-07-01")).toBe(3); // Wednesday
    expect(eachDateISO("2026-07-01", "2026-07-03")).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("addMinutes", () => {
    expect(addMinutes(new Date("2026-07-01T00:00:00Z"), 90).toISOString()).toBe("2026-07-01T01:30:00.000Z");
  });
});
