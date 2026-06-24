import { describe, expect, it } from "vitest";
import { computeFreeIntervals } from "../lib/availability";

const TZ = "Asia/Kolkata";

describe("computeFreeIntervals (pure)", () => {
  it("expands multi-range weekday rules to UTC intervals", () => {
    // 2026-07-01 is a Wednesday (weekday 3). Two ranges that day.
    const intervals = computeFreeIntervals({
      timezone: TZ,
      rules: [
        { weekday: 3, startTime: "09:00", endTime: "13:00" },
        { weekday: 3, startTime: "17:00", endTime: "20:00" },
      ],
      overrides: [],
      fromISO: "2026-07-01",
      toISO: "2026-07-01",
    });
    expect(intervals.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
      ["2026-07-01T03:30:00.000Z", "2026-07-01T07:30:00.000Z"], // 09:00–13:00 IST
      ["2026-07-01T11:30:00.000Z", "2026-07-01T14:30:00.000Z"], // 17:00–20:00 IST
    ]);
  });

  it("an unavailable override closes the date", () => {
    const intervals = computeFreeIntervals({
      timezone: TZ,
      rules: [{ weekday: 3, startTime: "09:00", endTime: "13:00" }],
      overrides: [{ date: "2026-07-01", isUnavailable: true }],
      fromISO: "2026-07-01",
      toISO: "2026-07-01",
    });
    expect(intervals).toEqual([]);
  });

  it("a custom-hours override replaces the weekly rules", () => {
    const intervals = computeFreeIntervals({
      timezone: TZ,
      rules: [{ weekday: 3, startTime: "09:00", endTime: "13:00" }],
      overrides: [{ date: "2026-07-01", isUnavailable: false, startTime: "15:00", endTime: "18:00" }],
      fromISO: "2026-07-01",
      toISO: "2026-07-01",
    });
    expect(intervals.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
      ["2026-07-01T09:30:00.000Z", "2026-07-01T12:30:00.000Z"], // 15:00–18:00 IST
    ]);
  });

  it("only emits intervals for days with matching rules", () => {
    // Range Wed–Fri but a rule only for Thursday (weekday 4 → 2026-07-02).
    const intervals = computeFreeIntervals({
      timezone: TZ,
      rules: [{ weekday: 4, startTime: "10:00", endTime: "11:00" }],
      overrides: [],
      fromISO: "2026-07-01",
      toISO: "2026-07-03",
    });
    expect(intervals).toHaveLength(1);
    expect(intervals[0].start.toISOString()).toBe("2026-07-02T04:30:00.000Z");
  });
});
