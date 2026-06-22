import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Append-only audit log for privileged mutations. Called by every super-admin mutation, inside the
// same transaction where possible (pass the tenantTransaction `db`). audit_logs is cross-tenant and
// not org-scoped via tenantDb.

export interface AuditEntry {
  actorUserId?: string | null;
  action: string; // e.g. "org.create" | "org.suspend"
  resourceType: string; // e.g. "organization"
  resourceId?: string | null;
  orgId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

// Accepts either the singleton or a (non-tenant) transaction client — both expose auditLog.
type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAuditLog(entry: AuditEntry, db: AuditClient = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      orgId: entry.orgId ?? null,
      metadata: entry.metadata,
    },
  });
}
