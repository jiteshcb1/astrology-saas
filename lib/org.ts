import { prisma } from "@/lib/db";

// Resolves an org for its PUBLIC booking page. Returns null for suspended/unknown slugs so the
// caller (SP-4 public page) renders a 404 — a suspended consultant's page goes offline.
export async function getActiveOrgBySlug(slug: string) {
  return prisma.organization.findFirst({
    where: { slug: slug.trim().toLowerCase(), status: "active" },
  });
}
