import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { stripUnsafeHtml } from "@/lib/gemini";
import { getActiveOrgBySlug } from "@/lib/public-page";

// Per-consultant legal documents (Privacy Policy + Terms & Conditions). Tenant-scoped; HTML is sanitized
// on save (defense-in-depth vs script/handlers). updatedAt drives the "Last updated" date on the profile.

export type LegalResult = { ok: true } | { ok: false; error: string };
export type LegalFormState = { error?: string; ok?: boolean };
export type LegalDocType = "privacy" | "terms";

// Pure: does the HTML hold real content (not just empty tags/whitespace)?
export function legalHasContent(html: string | null | undefined): boolean {
  return Boolean(html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0);
}

export async function getLegalDocuments(orgId: string) {
  return tenantDb(orgId).legalDocuments.findFirst();
}

export interface LegalInput {
  privacyPolicy: string;
  termsConditions: string;
}

export async function updateLegalCore(orgId: string, input: LegalInput, actorUserId: string): Promise<LegalResult> {
  const data = {
    privacyPolicy: stripUnsafeHtml(input.privacyPolicy),
    termsConditions: stripUnsafeHtml(input.termsConditions),
  };
  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).legalDocuments.findFirst();
    if (existing) {
      await tenant(orgId).legalDocuments.updateMany({ data });
    } else {
      await tenant(orgId).legalDocuments.create({ data });
    }
    await writeAuditLog(
      { actorUserId, action: "legal.update", resourceType: "legal_documents", resourceId: orgId, orgId },
      db,
    );
  });
  return { ok: true };
}

export interface ConsultantLegalView {
  title: string;
  html: string;
  updatedAtISO: string;
  consultantName: string;
  slug: string;
  themeColor: string | null;
  logoUrl: string | null;
}

// Public, slug-scoped resolver for a consultant's legal page. null if unknown/suspended/empty.
export async function getConsultantLegal(slug: string, type: LegalDocType): Promise<ConsultantLegalView | null> {
  const org = await getActiveOrgBySlug(slug);
  if (!org) return null;
  const doc = await tenantDb(org.orgId).legalDocuments.findFirst();
  if (!doc) return null;
  const html = type === "privacy" ? doc.privacyPolicy : doc.termsConditions;
  if (!legalHasContent(html)) return null;
  return {
    title: type === "privacy" ? "Privacy Policy" : "Terms & Conditions",
    html,
    updatedAtISO: doc.updatedAt.toISOString(),
    consultantName: org.profile.displayName || org.orgName,
    slug: org.slug,
    themeColor: org.branding.themeColor,
    logoUrl: org.branding.logoUrl,
  };
}
