import { describe, expect, it } from "vitest";
import { evaluateSlugInput, validateSlug } from "../lib/slug";

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

describe("evaluateSlugInput (real-time field UX)", () => {
  it("is empty for blank input", () => {
    expect(evaluateSlugInput("").status).toBe("empty");
  });

  it("gives min-length its own message", () => {
    const r = evaluateSlugInput("ab");
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/at least 3/i);
  });

  it("trims a leading hyphen with a clear note (not a generic invalid)", () => {
    const r = evaluateSlugInput("-jyoti");
    expect(r.display).toBe("jyoti");
    expect(r.canonical).toBe("jyoti");
    expect(r.note).toMatch(/start with a hyphen/i);
    expect(r.status).toBe("ok");
  });

  it("tolerates a trailing hyphen mid-typing (no error), trims on blur", () => {
    const typing = evaluateSlugInput("jyoti-", { typing: true });
    expect(typing.status).toBe("empty"); // neutral, not an error
    expect(typing.canonical).toBe("jyoti");

    const blurred = evaluateSlugInput("jyoti-", { typing: false });
    expect(blurred.status).toBe("ok");
    expect(blurred.canonical).toBe("jyoti");
    expect(blurred.note).toMatch(/trailing hyphen/i);
  });

  it("converts spaces and symbols to hyphens as you type (no error)", () => {
    const spaced = evaluateSlugInput("jyoti astro");
    expect(spaced.canonical).toBe("jyoti-astro");
    expect(spaced.status).toBe("ok");
    expect(spaced.note).toMatch(/become hyphens/i);

    // Consecutive hyphens / symbol runs collapse to a single hyphen.
    expect(evaluateSlugInput("a--b").canonical).toBe("a-b");
    expect(evaluateSlugInput("a & b!").canonical).toBe("a-b");
  });

  it("still flags reserved slugs", () => {
    expect(evaluateSlugInput("admin").message).toMatch(/reserved/i);
  });

  it("lowercases and accepts a valid slug", () => {
    const r = evaluateSlugInput("Jyoti-Astrology");
    expect(r.status).toBe("ok");
    expect(r.canonical).toBe("jyoti-astrology");
  });
});
