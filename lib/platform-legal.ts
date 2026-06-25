import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { stripUnsafeHtml } from "@/lib/gemini";

// Platform-level legal docs (super-admin authored). NOT tenant-scoped → bare prisma.platformLegal (allowed;
// the ESLint tenant-guard only bans registered tenant models). Viewable at /legal/*; HTML sanitized on save.

export const PLATFORM_DOC_TYPES = ["privacy", "terms_of_use", "terms"] as const;
export type PlatformDocType = (typeof PLATFORM_DOC_TYPES)[number];
export const PLATFORM_DOC_LABELS: Record<PlatformDocType, string> = {
  privacy: "Privacy Policy",
  terms_of_use: "Terms of Use",
  terms: "Terms & Conditions",
};

export type PlatformLegalResult = { ok: true } | { ok: false; error: string };
export type PlatformLegalFormState = { error?: string; ok?: boolean };

export async function getPlatformLegal(docType: PlatformDocType) {
  return prisma.platformLegal.findUnique({ where: { docType } });
}

export async function listPlatformLegal() {
  return prisma.platformLegal.findMany();
}

export async function updatePlatformLegalCore(docType: string, html: string, actorUserId: string): Promise<PlatformLegalResult> {
  if (!(PLATFORM_DOC_TYPES as readonly string[]).includes(docType)) return { ok: false, error: "Unknown document type." };
  const contentHtml = stripUnsafeHtml(html);
  await prisma.platformLegal.upsert({
    where: { docType },
    update: { contentHtml },
    create: { docType, contentHtml },
  });
  await writeAuditLog({ actorUserId, action: "platform_legal.update", resourceType: "platform_legal", resourceId: docType });
  return { ok: true };
}
