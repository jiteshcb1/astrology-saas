import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the guard's collaborators. redirect/notFound throw (as they do in Next) so we can
// assert which one fired. Declared via vi.hoisted so they exist when the hoisted vi.mock
// factories run.
const { authMock, findUniqueMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUniqueMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: findUniqueMock } } }));
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

import { requireRole } from "@/lib/rbac";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireRole — concern #1 (seeker denied) + liveness", () => {
  it("denies a seeker at /superadmin via notFound()", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "seeker" } });
    findUniqueMock.mockResolvedValue({ role: "seeker" });
    await expect(requireRole("access:superadmin")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("denies a seeker at /dashboard via notFound()", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", role: "seeker" } });
    findUniqueMock.mockResolvedValue({ role: "seeker" });
    await expect(requireRole("access:dashboard")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("redirects an unauthenticated visitor to /signin", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireRole("access:superadmin")).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/signin");
  });

  it("allows a super_admin at /superadmin", async () => {
    authMock.mockResolvedValue({ user: { id: "admin1", role: "super_admin" } });
    findUniqueMock.mockResolvedValue({ role: "super_admin" });
    const res = await requireRole("access:superadmin");
    expect(res.role).toBe("super_admin");
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("authorizes on the LIVE DB role, not the token claim", async () => {
    // Session claims super_admin (stale) but the DB says the user was demoted to seeker.
    authMock.mockResolvedValue({ user: { id: "u1", role: "super_admin" } });
    findUniqueMock.mockResolvedValue({ role: "seeker" });
    await expect(requireRole("access:superadmin")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
