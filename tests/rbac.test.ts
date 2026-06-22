import { describe, expect, it, vi } from "vitest";

// Pure-policy tests — stub the heavy deps so importing lib/rbac doesn't pull in NextAuth/Prisma.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import { can, roleHome } from "@/lib/rbac";

describe("can()", () => {
  it("super_admin → superadmin only", () => {
    expect(can({ role: "super_admin" }, "access:superadmin")).toBe(true);
    expect(can({ role: "super_admin" }, "access:dashboard")).toBe(false);
  });

  it("dashboard roles → dashboard only", () => {
    for (const role of ["consultant", "team_consulting", "team_accounts"]) {
      expect(can({ role }, "access:dashboard")).toBe(true);
      expect(can({ role }, "access:superadmin")).toBe(false);
    }
  });

  it("seeker → neither", () => {
    expect(can({ role: "seeker" }, "access:superadmin")).toBe(false);
    expect(can({ role: "seeker" }, "access:dashboard")).toBe(false);
  });

  it("missing/empty role → deny", () => {
    expect(can(null, "access:dashboard")).toBe(false);
    expect(can(undefined, "access:superadmin")).toBe(false);
    expect(can({ role: null }, "access:superadmin")).toBe(false);
  });
});

describe("roleHome()", () => {
  it("maps each role to its home", () => {
    expect(roleHome("super_admin")).toBe("/superadmin");
    expect(roleHome("consultant")).toBe("/dashboard");
    expect(roleHome("team_consulting")).toBe("/dashboard");
    expect(roleHome("team_accounts")).toBe("/dashboard");
    expect(roleHome("seeker")).toBe("/");
    expect(roleHome(null)).toBe("/");
  });
});
