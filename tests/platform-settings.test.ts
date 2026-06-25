import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getEmailSettings, isEmailCategoryEnabled, setEmailCategoryEnabled } from "../lib/platform-settings";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "psettings-";

d("platform email kill-switch", () => {
  const stamp = Date.now();
  let actorId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" } });
    actorId = actor.id;
    // Start clean: remove any pre-existing email setting rows so "default ON" is observable.
    await prisma.platformSetting.deleteMany({ where: { key: { in: ["emails.otp", "emails.transactional"] } } });
  });

  afterAll(async () => {
    await prisma.platformSetting.deleteMany({ where: { key: { in: ["emails.otp", "emails.transactional"] } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("defaults both categories ON when no row exists", async () => {
    expect(await isEmailCategoryEnabled("otp")).toBe(true);
    expect(await isEmailCategoryEnabled("transactional")).toBe(true);
    const v = await getEmailSettings();
    expect(v.otp.enabled).toBe(true);
    expect(v.transactional.enabled).toBe(true);
    expect(v.otp.updatedAtISO).toBeNull();
  });

  it("pausing one category is independent + audited; rejects unknown category", async () => {
    const r = await setEmailCategoryEnabled("otp", false, actorId);
    expect(r.ok).toBe(true);
    expect(await isEmailCategoryEnabled("otp")).toBe(false);
    expect(await isEmailCategoryEnabled("transactional")).toBe(true); // unaffected

    const v = await getEmailSettings();
    expect(v.otp.enabled).toBe(false);
    expect(v.otp.updatedAtISO).toBeTruthy();

    expect((await setEmailCategoryEnabled("bogus", false, actorId)).ok).toBe(false);
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "platform_setting.update" } })).toBeGreaterThan(0);

    // Re-enable round-trips.
    await setEmailCategoryEnabled("otp", true, actorId);
    expect(await isEmailCategoryEnabled("otp")).toBe(true);
  });
});
