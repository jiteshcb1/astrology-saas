import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import {
  createCatalogItemCore,
  deleteCatalogItemCore,
  getActiveCatalog,
  setCatalogItemActiveCore,
  updateCatalogItemCore,
} from "../lib/catalog";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "cattest-";

d("catalogs (SP-1.7)", () => {
  const stamp = Date.now();
  let actorId = "";

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "super_admin" },
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    await prisma.catalogItem.deleteMany({ where: { key: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.$disconnect();
  });

  it("creates an item, writes audit, and getActiveCatalog returns it sorted", async () => {
    const b = await createCatalogItemCore(
      { type: "theme_color", key: `${PREFIX}b-${stamp}`, label: "B", value: { hex: "#222222" }, sortOrder: 2 },
      actorId,
    );
    const a = await createCatalogItemCore(
      { type: "theme_color", key: `${PREFIX}a-${stamp}`, label: "A", value: { hex: "#111111" }, sortOrder: 1 },
      actorId,
    );
    expect(a.ok && b.ok).toBe(true);

    const active = await getActiveCatalog("theme_color");
    const mine = active.filter((i) => i.key.startsWith(PREFIX));
    expect(mine.map((i) => i.sortOrder)).toEqual([1, 2]); // sorted by sortOrder

    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "catalog.create" } })).toBeGreaterThan(0);
  });

  it("rejects a duplicate (type, key)", async () => {
    const key = `${PREFIX}dup-${stamp}`;
    expect((await createCatalogItemCore({ type: "font", key, label: "F", value: {}, sortOrder: 0 }, actorId)).ok).toBe(true);
    const dup = await createCatalogItemCore({ type: "font", key, label: "F2", value: {}, sortOrder: 0 }, actorId);
    expect(dup.ok).toBe(false);
  });

  it("rejects an invalid key", async () => {
    const bad = await createCatalogItemCore({ type: "font", key: "A B", label: "x", value: {}, sortOrder: 0 }, actorId);
    expect(bad.ok).toBe(false);
  });

  it("deactivating hides it from getActiveCatalog", async () => {
    const key = `${PREFIX}toggle-${stamp}`;
    const res = await createCatalogItemCore({ type: "calendar_provider", key, label: "Prov", value: {}, sortOrder: 0 }, actorId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    await setCatalogItemActiveCore(res.id, false, actorId);
    const active = await getActiveCatalog("calendar_provider");
    expect(active.some((i) => i.id === res.id)).toBe(false);
  });

  it("updates and deletes with audit", async () => {
    const res = await createCatalogItemCore({ type: "theme_color", key: `${PREFIX}upd-${stamp}`, label: "Old", value: { hex: "#000000" }, sortOrder: 5 }, actorId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const upd = await updateCatalogItemCore(res.id, { type: "theme_color", key: `${PREFIX}upd-${stamp}`, label: "New", value: { hex: "#ffffff" }, sortOrder: 6 }, actorId);
    expect(upd.ok).toBe(true);
    const item = await prisma.catalogItem.findUnique({ where: { id: res.id } });
    expect(item?.label).toBe("New");

    await deleteCatalogItemCore(res.id, actorId);
    expect(await prisma.catalogItem.findUnique({ where: { id: res.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "catalog.delete" } })).toBeGreaterThan(0);
  });
});
