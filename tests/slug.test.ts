import { describe, expect, it } from "vitest";
import { validateSlug } from "../lib/slug";

describe("validateSlug", () => {
  it("accepts well-formed slugs (case-insensitive)", () => {
    for (const s of ["abc", "jyoti-astrology", "a1-b2-c3", "JYOTI", "x".repeat(40)]) {
      expect(validateSlug(s)).toEqual({ ok: true });
    }
  });

  it("rejects bad format / length", () => {
    for (const s of ["ab", "-abc", "abc-", "a b", "a_b", "x".repeat(41)]) {
      expect(validateSlug(s).ok).toBe(false);
    }
  });

  it("rejects consecutive hyphens", () => {
    expect(validateSlug("a--b").ok).toBe(false);
  });

  it("rejects reserved slugs", () => {
    for (const s of ["api", "auth", "admin", "superadmin", "dashboard", "signin", "_next"]) {
      expect(validateSlug(s).ok).toBe(false);
    }
  });
});
