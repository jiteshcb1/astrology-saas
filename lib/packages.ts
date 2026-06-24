import { Prisma } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";

// Packages = bookable event types (SP-3). Per-package price (paise) + limits (buffers, min-notice,
// slot interval, frequency caps). Slug unique per org. Cores are testable; mutations go through
// tenantTransaction + writeAuditLog.

export const DURATION_OPTIONS = [15, 30, 45, 60] as const;

// Slugify a title or slug input: lowercase, non-alphanumeric runs → single hyphen, trimmed.
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface FreqLimit {
  per_day?: number;
  per_week?: number;
  per_month?: number;
}
export interface PackageInput {
  title: string;
  slug: string;
  description: string;
  allowedDurations: number[];
  defaultDurationMin: number;
  allowBookerChooseDuration: boolean;
  price: number; // paise
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  slotIntervalMin: number;
  freqLimit: FreqLimit;
  scheduleId?: string | null;
}

export type PackageResult = { ok: true; id: string } | { ok: false; error: string };
export type PackageFormState = { error?: string; ok?: boolean };

// Pure: keep only valid duration options, deduped + sorted.
export function parseDurations(values: (number | string)[]): number[] {
  const set = new Set<number>();
  for (const v of values) {
    const n = typeof v === "string" ? parseInt(v, 10) : v;
    if ((DURATION_OPTIONS as readonly number[]).includes(n)) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function validatePackageInput(input: PackageInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (!slugify(input.slug)) return "A URL slug is required.";
  if (input.allowedDurations.length === 0) return "Pick at least one duration.";
  if (!input.allowedDurations.includes(input.defaultDurationMin)) {
    return "The default duration must be one of the allowed durations.";
  }
  if (input.price < 0) return "Price can't be negative.";
  for (const n of [input.bufferBeforeMin, input.bufferAfterMin, input.minNoticeMin]) {
    if (n < 0) return "Buffers and notice can't be negative.";
  }
  if (input.slotIntervalMin <= 0) return "Slot interval must be greater than zero.";
  return null;
}

export async function listPackages(orgId: string) {
  return tenantDb(orgId).package.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getPackage(orgId: string, id: string) {
  return tenantDb(orgId).package.findFirst({ where: { id } });
}

// True when no OTHER package in this org already uses the slug (per-org uniqueness; excludeId skips
// the package being edited). Mirrors the DB unique index (organizationId, slug).
export async function isPackageSlugAvailable(
  orgId: string,
  slugRaw: string,
  excludeId?: string,
): Promise<boolean> {
  const slug = slugify(slugRaw);
  if (!slug) return false;
  const count = await tenantDb(orgId).package.count({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  return count === 0;
}

export async function savePackageCore(
  orgId: string,
  input: PackageInput,
  actorUserId: string,
  id?: string,
): Promise<PackageResult> {
  const err = validatePackageInput(input);
  if (err) return { ok: false, error: err };
  const slug = slugify(input.slug);

  const data = {
    title: input.title.trim(),
    slug,
    description: input.description.trim() || null,
    allowedDurations: input.allowedDurations,
    defaultDurationMin: input.defaultDurationMin,
    allowBookerChooseDuration: input.allowBookerChooseDuration,
    price: input.price,
    bufferBeforeMin: input.bufferBeforeMin,
    bufferAfterMin: input.bufferAfterMin,
    minNoticeMin: input.minNoticeMin,
    slotIntervalMin: input.slotIntervalMin,
    freqLimit: input.freqLimit as Prisma.InputJsonValue,
    scheduleId: input.scheduleId || null,
  };

  try {
    const resultId = await tenantTransaction(async ({ db, tenant }) => {
      let pkgId = id;
      if (id) {
        await tenant(orgId).package.updateMany({ where: { id }, data });
      } else {
        const created = await tenant(orgId).package.create({ data });
        pkgId = created.id;
      }
      await writeAuditLog(
        {
          actorUserId,
          action: id ? "package.update" : "package.create",
          resourceType: "package",
          resourceId: pkgId!,
          orgId,
          metadata: { slug },
        },
        db,
      );
      return pkgId!;
    });
    return { ok: true, id: resultId };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "You already have a package with that slug." };
    }
    throw e;
  }
}

export async function setPackageActiveCore(
  orgId: string,
  id: string,
  isActive: boolean,
  actorUserId: string,
): Promise<void> {
  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).package.updateMany({ where: { id }, data: { isActive } });
    await writeAuditLog(
      { actorUserId, action: "package.update", resourceType: "package", resourceId: id, orgId, metadata: { isActive } },
      db,
    );
  });
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deletePackageCore(
  orgId: string,
  id: string,
  actorUserId: string,
): Promise<DeleteResult> {
  // Guard: never cascade-delete bookings. Deactivate instead if any exist.
  const bookingCount = await tenantDb(orgId).booking.count({ where: { packageId: id } });
  if (bookingCount > 0) {
    return { ok: false, error: "This package has bookings — deactivate it instead of deleting." };
  }
  await tenantTransaction(async ({ db, tenant }) => {
    await tenant(orgId).package.deleteMany({ where: { id } });
    await writeAuditLog(
      { actorUserId, action: "package.delete", resourceType: "package", resourceId: id, orgId },
      db,
    );
  });
  return { ok: true };
}
