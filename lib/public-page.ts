import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { getBranding } from "@/lib/branding";
import { getProfile } from "@/lib/consultant-profile";
import { getSignedUrl } from "@/lib/storage";
import { formatMoney } from "@/lib/money";
import { normalizeSlug } from "@/lib/slug";

// Public, UNAUTHENTICATED read path for the booking page at /<slug>. Resolves a single ACTIVE org by
// slug and bundles ONLY public-facing data (no session, no cross-tenant access — every read is scoped
// to the resolved orgId; secrets like gateway keys / GST-enc are never selected). Suspended or unknown
// slugs return null → the route shows an offline page.

export interface PublicPackageView {
  id: string;
  title: string;
  durationLabel: string;
  priceLabel: string;
  descriptionHtml: string;
  defaultDurationMin: number;
  allowedDurations: number[];
  allowBookerChooseDuration: boolean;
}

export interface PublicPageData {
  orgId: string;
  orgName: string;
  slug: string;
  hostMemberIds: string[]; // owner + active Consulting members (round-robin pool, SP-5.2)
  timezone: string;
  confirmedCount: number;
  profile: {
    displayName: string;
    bio: string;
    experience: string;
    specialities: string[];
    socialLinks: Record<string, string>;
    complaintsContactNumber: string;
  };
  branding: { themeColor: string | null; logoUrl: string | null; backgroundStyle: string };
  legal: { hasPrivacy: boolean; hasTerms: boolean };
  packages: PublicPackageView[];
}

// Inlined (not imported from lib/legal, which imports this module) — does the HTML hold real content?
function htmlHasContent(html: string | null | undefined): boolean {
  return Boolean(html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0);
}

function durationLabel(p: { allowBookerChooseDuration: boolean; allowedDurations: number[]; defaultDurationMin: number }): string {
  if (p.allowBookerChooseDuration && p.allowedDurations.length > 0) {
    return `${[...p.allowedDurations].sort((a, b) => a - b).join("/")} min`;
  }
  return `${p.defaultDurationMin} min`;
}

export async function getActiveOrgBySlug(slugRaw: string): Promise<PublicPageData | null> {
  const slug = normalizeSlug(slugRaw);
  if (!slug) return null;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!org || org.status !== "active") return null;
  const orgId = org.id;

  const [branding, profile, schedule, hosts, pkgs, confirmedCount, legalDoc] = await Promise.all([
    getBranding(orgId),
    getProfile(orgId),
    tenantDb(orgId).availabilitySchedule.findFirst({ where: { isDefault: true } }),
    tenantDb(orgId).orgMember.findMany({ where: { role: { in: ["consultant", "team_consulting"] }, status: "active" }, orderBy: { createdAt: "asc" } }),
    tenantDb(orgId).package.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    tenantDb(orgId).booking.count({ where: { status: "confirmed" } }),
    tenantDb(orgId).legalDocuments.findFirst(),
  ]);

  const logoUrl = branding?.logoKey ? await getSignedUrl(branding.logoKey) : null;

  const packages: PublicPackageView[] = pkgs.map((p) => ({
    id: p.id,
    title: p.title,
    durationLabel: durationLabel(p),
    priceLabel: formatMoney(p.price),
    descriptionHtml: p.description ?? "",
    defaultDurationMin: p.defaultDurationMin,
    allowedDurations: p.allowedDurations,
    allowBookerChooseDuration: p.allowBookerChooseDuration,
  }));

  return {
    orgId,
    orgName: org.name,
    slug: org.slug,
    hostMemberIds: hosts.map((h) => h.id),
    timezone: schedule?.timezone ?? "Asia/Kolkata",
    confirmedCount,
    profile: {
      displayName: profile?.displayName ?? "",
      bio: profile?.bio ?? "",
      experience: profile?.experience ?? "",
      specialities: profile?.specialities ?? [],
      socialLinks: (profile?.socialLinks as Record<string, string>) ?? {},
      complaintsContactNumber: profile?.complaintsContactNumber ?? "",
    },
    branding: { themeColor: branding?.themeColor ?? null, logoUrl, backgroundStyle: branding?.backgroundStyle ?? "stars_zodiac" },
    legal: { hasPrivacy: htmlHasContent(legalDoc?.privacyPolicy), hasTerms: htmlHasContent(legalDoc?.termsConditions) },
    packages,
  };
}
