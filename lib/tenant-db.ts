import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import tenantModels from "@/config/tenant-models.json";

// Tenant-scoped data access — the ONLY sanctioned way to touch org-scoped models.
// Bare `prisma.<tenantModel>` and bare `prisma.$transaction` are lint-banned everywhere except
// this file (see eslint.config.mjs + CLAUDE.md). Adding a tenant model = add it to
// config/tenant-models.json AND to scope() below (and the TenantModelKey union).

type Db = PrismaClient | Prisma.TransactionClient;

// Keep in sync with config/tenant-models.json (which is the runtime source of truth).
export type TenantModelKey = "orgMember" | "receipt" | "consultantProfile";

const TENANT_MODELS: ReadonlySet<string> = new Set(tenantModels as string[]);

// Scoped facade: every op forces organizationId = orgId as the last-wins key, so a caller can
// neither omit nor override it. findUnique is intentionally NOT exposed (its where can't carry a
// non-unique scope); create's data type omits organizationId so it can't even be supplied.
function scope(orgId: string, db: Db) {
  return {
    orgMember: {
      findMany: (args?: Prisma.OrgMemberFindManyArgs) =>
        db.orgMember.findMany({ ...args, where: { ...args?.where, organizationId: orgId } }),
      findFirst: (args?: Prisma.OrgMemberFindFirstArgs) =>
        db.orgMember.findFirst({ ...args, where: { ...args?.where, organizationId: orgId } }),
      count: (args?: Prisma.OrgMemberCountArgs) =>
        db.orgMember.count({ ...args, where: { ...args?.where, organizationId: orgId } }),
      create: (
        args: { data: Omit<Prisma.OrgMemberUncheckedCreateInput, "organizationId"> } & Pick<
          Prisma.OrgMemberCreateArgs,
          "select" | "include"
        >,
      ) =>
        db.orgMember.create({
          ...args,
          data: { ...args.data, organizationId: orgId },
        }),
      updateMany: (args: Prisma.OrgMemberUpdateManyArgs) =>
        db.orgMember.updateMany({ ...args, where: { ...args.where, organizationId: orgId } }),
      deleteMany: (args?: Prisma.OrgMemberDeleteManyArgs) =>
        db.orgMember.deleteMany({ ...args, where: { ...args?.where, organizationId: orgId } }),
    },
    receipt: {
      findMany: (args?: Prisma.ReceiptFindManyArgs) =>
        db.receipt.findMany({ ...args, where: { ...args?.where, organizationId: orgId } }),
      findFirst: (args?: Prisma.ReceiptFindFirstArgs) =>
        db.receipt.findFirst({ ...args, where: { ...args?.where, organizationId: orgId } }),
      count: (args?: Prisma.ReceiptCountArgs) =>
        db.receipt.count({ ...args, where: { ...args?.where, organizationId: orgId } }),
      create: (
        args: { data: Omit<Prisma.ReceiptUncheckedCreateInput, "organizationId"> } & Pick<
          Prisma.ReceiptCreateArgs,
          "select" | "include"
        >,
      ) =>
        db.receipt.create({
          ...args,
          data: { ...args.data, organizationId: orgId },
        }),
    },
    consultantProfile: {
      findFirst: (args?: Prisma.ConsultantProfileFindFirstArgs) =>
        db.consultantProfile.findFirst({ ...args, where: { ...args?.where, organizationId: orgId } }),
      count: (args?: Prisma.ConsultantProfileCountArgs) =>
        db.consultantProfile.count({ ...args, where: { ...args?.where, organizationId: orgId } }),
      create: (
        args: { data: Omit<Prisma.ConsultantProfileUncheckedCreateInput, "organizationId"> } & Pick<
          Prisma.ConsultantProfileCreateArgs,
          "select" | "include"
        >,
      ) =>
        db.consultantProfile.create({
          ...args,
          data: { ...args.data, organizationId: orgId },
        }),
      updateMany: (args: Prisma.ConsultantProfileUpdateManyArgs) =>
        db.consultantProfile.updateMany({ ...args, where: { ...args.where, organizationId: orgId } }),
    },
  };
}

export type Scoped = ReturnType<typeof scope>;
export type NonTenantClient = Omit<Prisma.TransactionClient, TenantModelKey>;

// Non-transaction scoped access.
export const tenantDb = (orgId: string): Scoped => scope(orgId, prisma);

// Runtime backstop: a transaction client with tenant models removed. Accessing one throws, so the
// only path to a tenant model inside a transaction is tenant(orgId).
function blockTenantModels(tx: Prisma.TransactionClient): NonTenantClient {
  return new Proxy(tx, {
    get(target, prop) {
      if (typeof prop === "string" && TENANT_MODELS.has(prop)) {
        throw new Error(
          `Tenant model "${prop}" is not accessible on the raw transaction client — ` +
            `use tenant(orgId).${prop} inside tenantTransaction().`,
        );
      }
      return Reflect.get(target, prop, target);
    },
  }) as unknown as NonTenantClient;
}

// The ONLY sanctioned transaction entry point. Never hands out a raw tx:
//  - `db` exposes non-tenant models only (Omit at type level + throwing Proxy at runtime);
//  - `tenant(orgId)` is the scoped facade bound to the tx (orgId may be computed mid-transaction).
export function tenantTransaction<T>(
  cb: (ctx: { db: NonTenantClient; tenant: (orgId: string) => Scoped }) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) =>
    cb({ db: blockTenantModels(tx), tenant: (orgId) => scope(orgId, tx) }),
  );
}
