import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { slugAvailabilityCore } from "../lib/consultants";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "slugavail-";

d("slugAvailabilityCore (SP-1.8)", () => {
  const stamp = Date.now();
  const takenSlug = `${PREFIX}taken-${stamp}`;

  beforeAll(async () => {
    await prisma.organization.create({ data: { name: "Taken Org", slug: takenSlug } });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("reports a taken slug as unavailable", async () => {
    const res = await slugAvailabilityCore(takenSlug);
    expect(res.available).toBe(false);
    expect(res.reason).toBe("taken");
  });

  it("reports a fresh, valid slug as available", async () => {
    const res = await slugAvailabilityCore(`${PREFIX}free-${stamp}`);
    expect(res.available).toBe(true);
  });

  it("rejects an invalid/reserved slug without a DB hit being authoritative", async () => {
    expect((await slugAvailabilityCore("ab")).available).toBe(false); // too short
    expect((await slugAvailabilityCore("admin")).available).toBe(false); // reserved
  });
});
