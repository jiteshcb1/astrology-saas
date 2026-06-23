import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// SANCTIONED super-admin cross-tenant READ path (foundation decision #6 — the "super_admin bypass
// for oversight"). This is the ONLY place outside lib/tenant-db.ts allowed to touch tenant-scoped
// models directly, and ONLY for reads (lint-exempt in eslint.config.mjs; see CLAUDE.md). Every read
// records an access entry in audit_logs. Do NOT add writes to tenant models here.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function logOversightAccess(
  actorUserId: string | null,
  resourceType: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await writeAuditLog({ actorUserId, action: "oversight.view", resourceType, metadata });
}

export async function listAllReceipts(
  actorUserId: string | null,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
) {
  const take = Math.min(Math.max(pageSize, 1), 100);
  const current = Math.max(page, 1);
  const skip = (current - 1) * take;

  const [items, total] = await Promise.all([
    prisma.receipt.findMany({
      orderBy: { issuedAt: "desc" },
      skip,
      take,
      include: { organization: { select: { name: true, slug: true } } },
    }),
    prisma.receipt.count(),
  ]);

  await logOversightAccess(actorUserId, "receipts", { page: current, pageSize: take, total });
  return { items, total, page: current, pageSize: take } satisfies Paginated<(typeof items)[number]>;
}
