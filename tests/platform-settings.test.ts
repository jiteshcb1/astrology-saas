import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getEmailSettingsView, isEmailTypeEnabled, setEmailSetting, MASTER_KEY } from "../lib/platform-settings";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "psettings-";

// All email setting rows are keyed "emails.*" — clean them so "default ON" is observable + tests are isolated.
async function clearEmailSettings() {
  await prisma.platformSetting.deleteMany({ where: { key: { startsWith: "emails." } } });
}

d("platform email kill-switch (per-type + master)", () => {
  const stamp = Date.now();
  let actorId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" } });
    actorId = actor.id;
    await clearEmailSettings();
  });

  afterAll(async () => {
    await clearEmailSettings();
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("every type defaults ON when no row exists", async () => {
    expect(await isEmailTypeEnabled("otp")).toBe(true);
    expect(await isEmailTypeEnabled("booking_confirmed")).toBe(true);
    const v = await getEmailSettingsView();
    expect(v.master.enabled).toBe(true);
    expect(v.master.updatedAtISO).toBeNull();
    expect(v.types.find((t) => t.key === "otp")?.enabled).toBe(true);
  });

  it("pausing one type is independent + audited; rejects unknown key", async () => {
    const r = await setEmailSetting("booking_confirmed", false, actorId);
    expect(r.ok).toBe(true);
    expect(await isEmailTypeEnabled("booking_confirmed")).toBe(false);
    expect(await isEmailTypeEnabled("proof_received")).toBe(true); // other types unaffected
    expect(await isEmailTypeEnabled("otp")).toBe(true);

    expect((await setEmailSetting("not_a_type", false, actorId)).ok).toBe(false);
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "platform_setting.update" } })).toBeGreaterThan(0);

    // Re-enable round-trips.
    await setEmailSetting("booking_confirmed", true, actorId);
    expect(await isEmailTypeEnabled("booking_confirmed")).toBe(true);
  });

  it("master OFF gates every type even when the type's own row is ON; re-enabling restores", async () => {
    await setEmailSetting("otp", true, actorId); // type explicitly ON
    await setEmailSetting(MASTER_KEY, false, actorId);
    expect(await isEmailTypeEnabled("otp")).toBe(false); // master overrides
    expect(await isEmailTypeEnabled("new_booking")).toBe(false);
    const v = await getEmailSettingsView();
    expect(v.master.enabled).toBe(false);

    await setEmailSetting(MASTER_KEY, true, actorId);
    expect(await isEmailTypeEnabled("otp")).toBe(true); // type row still ON → restored
  });
});
