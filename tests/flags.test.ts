import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { deleteFlagCore, isFeatureEnabled, resolveFlag, setFlagCore } from "../lib/flags";

// ── Pure precedence (always runs) ───────────────────────────────────────────────
describe("resolveFlag precedence", () => {
  it("returns the first defined layer: org > plan > global", () => {
    expect(resolveFlag({ org: true, plan: false, global: false })).toBe(true);
    expect(resolveFlag({ plan: true, global: false })).toBe(true);
    expect(resolveFlag({ global: true })).toBe(true);
  });

  it("a higher-layer false overrides a lower-layer true", () => {
    expect(resolveFlag({ org: false, plan: true, global: true })).toBe(false);
    expect(resolveFlag({ plan: false, global: true })).toBe(false);
  });

  it("defaults to false when no layer is defined", () => {
    expect(resolveFlag({})).toBe(false);
  });
});

// ── DB-backed resolver + cores ──────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "flagtest-";

d("feature flag resolver + cores (SP-1.5)", () => {
  const stamp = Date.now();
  const KEY = `${PREFIX}${stamp}`;
  let actorId = "";
  let orgId = "";
  let planId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
    const plan = await prisma.subscriptionPlan.create({
      data: { name: `${PREFIX}plan`, price: 0, includedSeats: 1, perSeatPrice: 0 },
    });
    planId = plan.id;
    const org = await prisma.organization.create({
      data: { name: "Flag Test Org", slug: `${PREFIX}org-${stamp}` },
    });
    orgId = org.id;
    await prisma.subscription.create({ data: { orgId, planId, seatCount: 1, status: "active" } });
  });

  afterAll(async () => {
    await prisma.featureFlag.deleteMany({ where: { key: KEY } });
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  const flagId = async (scope: "global" | "plan" | "org", scopeId: string | null) =>
    (await prisma.featureFlag.findFirst({ where: { key: KEY, scope, scopeId } }))!.id;

  it("resolves org > plan > global > false end-to-end", async () => {
    // global=true, plan=false, org=true
    expect((await setFlagCore({ key: KEY, scope: "global", scopeId: null, enabled: true }, actorId)).ok).toBe(true);
    expect((await setFlagCore({ key: KEY, scope: "plan", scopeId: planId, enabled: false }, actorId)).ok).toBe(true);
    expect((await setFlagCore({ key: KEY, scope: "org", scopeId: orgId, enabled: true }, actorId)).ok).toBe(true);
    expect(await isFeatureEnabled(KEY, orgId)).toBe(true); // org wins

    await deleteFlagCore(await flagId("org", orgId), actorId);
    expect(await isFeatureEnabled(KEY, orgId)).toBe(false); // plan wins (false)

    await deleteFlagCore(await flagId("plan", planId), actorId);
    expect(await isFeatureEnabled(KEY, orgId)).toBe(true); // global wins (true)

    await deleteFlagCore(await flagId("global", null), actorId);
    expect(await isFeatureEnabled(KEY, orgId)).toBe(false); // nothing defined
  });

  it("upserts (no duplicate row) and writes audit entries", async () => {
    await setFlagCore({ key: KEY, scope: "global", scopeId: null, enabled: true }, actorId);
    await setFlagCore({ key: KEY, scope: "global", scopeId: null, enabled: false }, actorId);
    expect(await prisma.featureFlag.count({ where: { key: KEY, scope: "global" } })).toBe(1);
    expect(await isFeatureEnabled(KEY, orgId)).toBe(false);
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "flag.set" } })).toBeGreaterThan(0);

    await deleteFlagCore(await flagId("global", null), actorId);
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "flag.delete" } })).toBeGreaterThan(0);
  });

  it("rejects invalid keys and missing scope targets", async () => {
    expect((await setFlagCore({ key: "AB", scope: "global", scopeId: null, enabled: true }, actorId)).ok).toBe(false);
    expect((await setFlagCore({ key: KEY, scope: "plan", scopeId: null, enabled: true }, actorId)).ok).toBe(false);
    expect((await setFlagCore({ key: KEY, scope: "org", scopeId: "nope", enabled: true }, actorId)).ok).toBe(false);
  });
});
