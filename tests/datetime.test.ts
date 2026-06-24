import { describe, expect, it } from "vitest";
import {
  clampToStep,
  compareDateTime,
  compareTime,
  dateToISO,
  formatTime,
  isValidRange,
  isoToDate,
  joinDateTime,
  rangeValidity,
  reconcileEnd,
  splitDateTime,
  timeOptions,
} from "../lib/datetime";

describe("datetime — comparison & range", () => {
  it("compareTime / compareDateTime order correctly", () => {
    expect(compareTime("09:00", "17:00")).toBe(-1);
    expect(compareTime("17:00", "09:00")).toBe(1);
    expect(compareTime("09:00", "09:00")).toBe(0);
    // Month boundary + leap day via string compare on datetimes.
    expect(compareDateTime("2026-02-28T23:45", "2026-03-01T00:00")).toBe(-1);
    expect(compareDateTime("2028-02-29T10:00", "2028-03-01T09:00")).toBe(-1); // leap day
    expect(compareDateTime("2026-12-31T23:59", "2027-01-01T00:00")).toBe(-1); // year end
  });

  it("isValidRange: both present and start strictly before end", () => {
    expect(isValidRange("09:00", "17:00")).toBe(true);
    expect(isValidRange("17:00", "09:00")).toBe(false);
    expect(isValidRange("09:00", "09:00")).toBe(false); // equal is not valid
    expect(isValidRange("", "17:00")).toBe(false);
    expect(isValidRange("09:00", "")).toBe(false);
  });

  it("rangeValidity exposes a reason for forms", () => {
    expect(rangeValidity("09:00", "17:00")).toEqual({ valid: true });
    expect(rangeValidity("17:00", "09:00").valid).toBe(false);
    expect(rangeValidity("09:00", "09:00").reason).toBe("End must be after start.");
    expect(rangeValidity("09:00", "").reason).toBe("Both a start and end are needed.");
    expect(rangeValidity("", "")).toEqual({ valid: true }); // optional empty is fine
    expect(rangeValidity("", "", { required: true })).toEqual({ valid: false, reason: "Required." });
  });

  it("reconcileEnd clears an end that is no longer after start", () => {
    expect(reconcileEnd("09:00", "17:00")).toBe("17:00"); // still valid → kept
    expect(reconcileEnd("18:00", "17:00")).toBe(""); // start moved past end → cleared
    expect(reconcileEnd("17:00", "17:00")).toBe(""); // equal → cleared
    expect(reconcileEnd("", "17:00")).toBe("17:00"); // no start yet → leave end
    // Works for datetimes too.
    expect(reconcileEnd("2026-07-02T09:00", "2026-07-01T10:00")).toBe("");
    expect(reconcileEnd("2026-07-01T09:00", "2026-07-01T10:00")).toBe("2026-07-01T10:00");
  });
});

describe("datetime — time options & formatting", () => {
  it("timeOptions steps and respects inclusive bounds", () => {
    expect(timeOptions(60).length).toBe(24);
    expect(timeOptions(15).length).toBe(96);
    const bounded = timeOptions(30, { min: "09:00", max: "11:00" });
    expect(bounded).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("clampToStep floors to the step", () => {
    expect(clampToStep("09:07", 15)).toBe("09:00");
    expect(clampToStep("09:52", 15)).toBe("09:45");
  });

  it("formatTime 12h / 24h", () => {
    expect(formatTime("09:00")).toBe("9:00 AM");
    expect(formatTime("13:30")).toBe("1:30 PM");
    expect(formatTime("00:15")).toBe("12:15 AM");
    expect(formatTime("13:30", false)).toBe("13:30");
    expect(formatTime("")).toBe("");
  });
});

describe("datetime — date <-> ISO & split/join", () => {
  it("isoToDate / dateToISO round-trip (and handle leap day)", () => {
    expect(dateToISO(isoToDate("2028-02-29")!)).toBe("2028-02-29");
    expect(dateToISO(isoToDate("2026-12-31")!)).toBe("2026-12-31");
    expect(isoToDate("nonsense")).toBeUndefined();
  });

  it("splitDateTime / joinDateTime", () => {
    expect(splitDateTime("2026-07-01T09:30")).toEqual({ date: "2026-07-01", time: "09:30" });
    expect(splitDateTime("")).toEqual({ date: "", time: "" });
    expect(joinDateTime("2026-07-01", "09:30")).toBe("2026-07-01T09:30");
    expect(joinDateTime("2026-07-01", "")).toBe(""); // incomplete → empty
    expect(joinDateTime("", "09:30")).toBe("");
  });
});
