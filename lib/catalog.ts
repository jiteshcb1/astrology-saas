import { type CatalogType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";

// Global platform catalogs (theme colors, fonts, calendar providers) consumed by the consultant
// app (SP-2). Super-admin managed; NOT tenant-scoped. getActiveCatalog is the in-monolith
// "internal API". Cores are free of "use server"/redirect so they're unit-testable.

const KEY_RE = /^[a-z0-9][a-z0-9_.-]{0,48}[a-z0-9]$/;

export type CatalogFormState = { error?: string };
export type CatalogResult = { ok: true; id: string } | { ok: false; error: string };
export type CatalogMutationResult = { ok: true } | { ok: false; error: string };

export interface CatalogInput {
  type: CatalogType;
  key: string;
  label: string;
  value: Prisma.InputJsonValue;
  sortOrder: number;
}

// The internal API SP-2 imports directly: active items of a type, ordered for display.
export async function getActiveCatalog(type: CatalogType) {
  return prisma.catalogItem.findMany({
    where: { type, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

function validate(input: CatalogInput): string | null {
  if (!KEY_RE.test(input.key.trim().toLowerCase()))
    return "Key must be 2–50 chars: lowercase letters, digits, '.', '_' or '-'.";
  if (!input.label.trim()) return "Label is required.";
  if (!Number.isInteger(input.sortOrder)) return "Sort order must be a whole number.";
  return null;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createCatalogItemCore(
  input: CatalogInput,
  actorUserId: string,
): Promise<CatalogResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const key = input.key.trim().toLowerCase();
  try {
    const id = await tenantTransaction(async ({ db }) => {
      const item = await db.catalogItem.create({
        data: { type: input.type, key, label: input.label.trim(), value: input.value, sortOrder: input.sortOrder },
      });
      await writeAuditLog(
        {
          actorUserId,
          action: "catalog.create",
          resourceType: "catalog_item",
          resourceId: item.id,
          metadata: { type: input.type, key },
        },
        db,
      );
      return item.id;
    });
    return { ok: true, id };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "An item with that type + key already exists." };
    throw e;
  }
}

export async function updateCatalogItemCore(
  id: string,
  input: CatalogInput,
  actorUserId: string,
): Promise<CatalogMutationResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  const key = input.key.trim().toLowerCase();
  try {
    await tenantTransaction(async ({ db }) => {
      await db.catalogItem.update({
        where: { id },
        data: { type: input.type, key, label: input.label.trim(), value: input.value, sortOrder: input.sortOrder },
      });
      await writeAuditLog(
        {
          actorUserId,
          action: "catalog.update",
          resourceType: "catalog_item",
          resourceId: id,
          metadata: { type: input.type, key },
        },
        db,
      );
    });
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "An item with that type + key already exists." };
    throw e;
  }
}

export async function setCatalogItemActiveCore(
  id: string,
  isActive: boolean,
  actorUserId: string,
): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    await db.catalogItem.update({ where: { id }, data: { isActive } });
    await writeAuditLog(
      {
        actorUserId,
        action: "catalog.update",
        resourceType: "catalog_item",
        resourceId: id,
        metadata: { isActive },
      },
      db,
    );
  });
}

export async function deleteCatalogItemCore(id: string, actorUserId: string): Promise<void> {
  await tenantTransaction(async ({ db }) => {
    await db.catalogItem.delete({ where: { id } });
    await writeAuditLog(
      { actorUserId, action: "catalog.delete", resourceType: "catalog_item", resourceId: id },
      db,
    );
  });
}
