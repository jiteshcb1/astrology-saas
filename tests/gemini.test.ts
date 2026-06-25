import { afterEach, describe, expect, it } from "vitest";
import { isAiConfigured, safeParseJson, truncate, sanitizeSpecialities, coerceQuestions, stripUnsafeHtml } from "../lib/gemini";
import { SPECIALITY_OPTIONS } from "../lib/consultant-profile";

// Pure helpers — always run (no network). These prove an AI failure / wild output can't break a form.
describe("gemini helpers (pure)", () => {
  const orig = process.env.GOOGLE_AI_STUDIO_API_KEY;
  afterEach(() => {
    if (orig === undefined) delete process.env.GOOGLE_AI_STUDIO_API_KEY;
    else process.env.GOOGLE_AI_STUDIO_API_KEY = orig;
  });

  it("isAiConfigured reflects the env key (absent → false → button hidden)", () => {
    delete process.env.GOOGLE_AI_STUDIO_API_KEY;
    expect(isAiConfigured()).toBe(false);
    process.env.GOOGLE_AI_STUDIO_API_KEY = "test-key";
    expect(isAiConfigured()).toBe(true);
  });

  it("safeParseJson never throws (returns null on malformed; recovers fenced JSON)", () => {
    expect(safeParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(safeParseJson("not json")).toBeNull();
    expect(safeParseJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(safeParseJson("")).toBeNull();
  });

  it("truncate caps length and coerces non-strings", () => {
    expect(truncate("hello world", 5)).toBe("hello");
    expect(truncate(12345, 3)).toBe("");
    expect(truncate("  trimmed  ", 100)).toBe("trimmed");
  });

  it("sanitizeSpecialities keeps only canonical options, dedupes, caps 8", () => {
    const out = sanitizeSpecialities(["Tarot", "tarot", "Made Up", SPECIALITY_OPTIONS[0], "Numerology"]);
    expect(out).toContain("Tarot");
    expect(out).toContain("Numerology");
    expect(out).not.toContain("Made Up");
    expect(new Set(out).size).toBe(out.length); // deduped
    out.forEach((s) => expect(SPECIALITY_OPTIONS).toContain(s));
    expect(sanitizeSpecialities("not an array")).toEqual([]);
  });

  it("coerceQuestions drops malformed, fixes field types, caps 5", () => {
    const raw = [
      { label: "Date of birth", fieldType: "date", requirement: "required" },
      { label: "Bad type", fieldType: "rocket", requirement: "weird" }, // → short_text / optional
      { label: "", fieldType: "short_text" }, // dropped (no label)
      { label: "Pick one", fieldType: "select", requirement: "optional", options: ["A", "B"] },
      { label: "Empty dropdown", fieldType: "select", options: [] }, // dropped (no options)
    ];
    const out = coerceQuestions(raw);
    expect(out.map((q) => q.label)).toEqual(["Date of birth", "Bad type", "Pick one"]);
    expect(out[0].fieldType).toBe("date");
    expect(out[1].fieldType).toBe("short_text");
    expect(out[1].requirement).toBe("optional");
    expect(out[2].options).toEqual(["A", "B"]);
    expect(coerceQuestions("nope")).toEqual([]);
    expect(coerceQuestions(Array.from({ length: 20 }, (_, i) => ({ label: `Q${i}`, fieldType: "short_text", requirement: "optional" }))).length).toBe(5);
  });

  it("stripUnsafeHtml removes scripts + inline handlers", () => {
    const dirty = '<p>Hi</p><script>alert(1)</script><a href="x" onclick="evil()">link</a>';
    const clean = stripUnsafeHtml(dirty);
    expect(clean).toContain("<p>Hi</p>");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
  });
});
