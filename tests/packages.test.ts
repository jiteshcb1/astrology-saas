import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getPackage, listPackages, parseDurations, savePackageCore, validatePackageInput } from "../lib/packages";

describe("packages (pure)", () => {
  it("parseDurations keeps valid options, dedupes, sorts", () => {
    expect(parseDurations(["60", "15", "15", 30, 999])).toEqual([15, 30, 60]);
    expect(parseDurations([])).toEqual([]);
  });

  it("validatePackageInput enforces the basics", () => {
    const base = {
      title: "X", slug: "x", description: "", allowedDurations: [30], defaultDurationMin: 30,
      allowBookerChooseDuration: false, price: 1000, bufferBeforeMin: 0, bufferAfterMin: 0,
      minNoticeMin: 0, slotIntervalMin: 15, freqLimit: {},
    };
    expect(validatePackageInput(base)).toBeNull();
    expect(validatePackageInput({ ...base, title: "" })).toBeTruthy();
    expect(validatePackageInput({ ...base, allowedDurations: [] })).toBeTruthy();
    expect(validatePackageInput({ ...base, defaultDurationMin: 45 })).toBeTruthy(); // not in allowed
    expect(validatePackageInput({ ...base, price: -1 })).toBeTruthy();
    expect(validatePackageInput({ ...base, slotIntervalMin: 0 })).toBeTruthy();
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "pkg-";

d("package cores (SP-3)", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}a-${stamp}@example.com`, role: "consultant" } });
    actorId = actor.id;
    const org = await prisma.organization.create({ data: { name: "Pkg Org", slug: `${PREFIX}org-${stamp}` } });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  const base = {
    title: "Kundali Reading", slug: "Kundali Reading", description: "Full chart",
    allowedDurations: [30, 60], defaultDurationMin: 60, allowBookerChooseDuration: true,
    price: 110000, bufferBeforeMin: 5, bufferAfterMin: 10, minNoticeMin: 120, slotIntervalMin: 30,
    freqLimit: { per_day: 6 },
  };

  it("creates a package (slug normalized, price + limits persisted) + audit", async () => {
    const res = await savePackageCore(orgId, base, actorId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const pkg = await getPackage(orgId, res.id);
    expect(pkg?.slug).toBe("kundali-reading");
    expect(pkg?.price).toBe(110000);
    expect(pkg?.allowedDurations).toEqual([30, 60]);
    expect(pkg?.minNoticeMin).toBe(120);
    expect(pkg?.freqLimit).toEqual({ per_day: 6 });
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "package.create" } })).toBeGreaterThan(0);
  });

  it("rejects a duplicate slug for the same org", async () => {
    const res = await savePackageCore(orgId, { ...base, title: "Another" }, actorId);
    expect(res.ok).toBe(false);
  });

  it("lists packages for the org", async () => {
    const list = await listPackages(orgId);
    expect(list.length).toBeGreaterThan(0);
  });
});
