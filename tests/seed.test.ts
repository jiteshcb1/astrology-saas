import { describe, expect, it } from "vitest";
import { DEV_SUPERADMIN_EMAIL, resolveSuperadminEmail } from "../lib/superadmin";

describe("resolveSuperadminEmail — concern #2 (bootstrap safety)", () => {
  it("throws in production when unset", () => {
    expect(() => resolveSuperadminEmail(undefined, "production")).toThrow();
    expect(() => resolveSuperadminEmail("", "production")).toThrow();
    expect(() => resolveSuperadminEmail("   ", "production")).toThrow();
  });

  it("throws in production for the dev placeholder (any case)", () => {
    expect(() => resolveSuperadminEmail(DEV_SUPERADMIN_EMAIL, "production")).toThrow();
    expect(() => resolveSuperadminEmail("ADMIN@astro.local", "production")).toThrow();
  });

  it("accepts an explicit real address in production (normalized)", () => {
    expect(resolveSuperadminEmail("Ops@Example.com", "production")).toBe("ops@example.com");
  });

  it("falls back to the dev placeholder outside production", () => {
    expect(resolveSuperadminEmail(undefined, "development")).toBe(DEV_SUPERADMIN_EMAIL);
    expect(resolveSuperadminEmail("dev@example.com", "test")).toBe("dev@example.com");
  });
});
