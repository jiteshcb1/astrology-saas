import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/db";
import { getConsultantLegal, getLegalDocuments, legalHasContent, updateLegalCore } from "../lib/legal";
import { getPlatformLegal, updatePlatformLegalCore } from "../lib/platform-legal";

// ── Pure: content detection ───────────────────────────────────────────────────
describe("legalHasContent", () => {
  it("false for empty / whitespace / tag-only HTML", () => {
    expect(legalHasContent("")).toBe(false);
    expect(legalHasContent(null)).toBe(false);
    expect(legalHasContent("   ")).toBe(false);
    expect(legalHasContent("<p></p>")).toBe(false);
    expect(legalHasContent("<ul><li></li></ul>")).toBe(false);
    expect(legalHasContent("<p>&nbsp;</p>")).toBe(false);
  });
  it("true once there is real text", () => {
    expect(legalHasContent("<p>We respect your privacy.</p>")).toBe(true);
    expect(legalHasContent("<ul><li>Bookings are final.</li></ul>")).toBe(true);
  });
});

// ── DB-backed cores ───────────────────────────────────────────────────────────
const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;
const PREFIX = "legaldoc-";

d("legal documents cores", () => {
  const stamp = Date.now();
  let actorId = "";
  let orgId = "";
  const slug = `${PREFIX}org-${stamp}`;

  beforeAll(async () => {
    const actor = await prisma.user.create({ data: { email: `${PREFIX}admin-${stamp}@example.com`, role: "consultant" } });
    actorId = actor.id;
    const org = await prisma.organization.create({ data: { name: "Legal Org", slug, status: "active" } });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { startsWith: PREFIX } } }); // cascades legal_documents
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.platformLegal.deleteMany({ where: { docType: "terms_of_use" } });
    await prisma.$disconnect();
  });

  it("updateLegalCore strips unsafe HTML, persists, and audits", async () => {
    const r = await updateLegalCore(
      orgId,
      { privacyPolicy: "<p>Safe.</p><script>alert(1)</script>", termsConditions: "<p>Be nice.</p>" },
      actorId,
    );
    expect(r.ok).toBe(true);
    const doc = await getLegalDocuments(orgId);
    expect(doc?.privacyPolicy).toContain("Safe.");
    expect(doc?.privacyPolicy.toLowerCase()).not.toContain("<script");
    expect(doc?.termsConditions).toContain("Be nice.");
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "legal.update" } })).toBeGreaterThan(0);
  });

  it("upserts in place and advances updatedAt", async () => {
    const before = (await getLegalDocuments(orgId))!.updatedAt.getTime();
    const r = await updateLegalCore(orgId, { privacyPolicy: "<p>Updated.</p>", termsConditions: "<p>Be nice.</p>" }, actorId);
    expect(r.ok).toBe(true);
    const doc = await getLegalDocuments(orgId);
    expect(await prisma.legalDocuments.count({ where: { organizationId: orgId } })).toBe(1);
    expect(doc!.privacyPolicy).toContain("Updated.");
    expect(doc!.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("getConsultantLegal resolves a present doc and returns null for empty / unknown", async () => {
    const priv = await getConsultantLegal(slug, "privacy");
    expect(priv?.title).toBe("Privacy Policy");
    expect(priv?.html).toContain("Updated.");
    expect(priv?.updatedAtISO).toBeTruthy();

    // Terms now blank → null.
    await updateLegalCore(orgId, { privacyPolicy: "<p>Updated.</p>", termsConditions: "" }, actorId);
    expect(await getConsultantLegal(slug, "terms")).toBeNull();
    expect(await getConsultantLegal(`${PREFIX}nope-${stamp}`, "privacy")).toBeNull();
  });

  it("platform legal: validates docType, round-trips, and audits", async () => {
    expect((await updatePlatformLegalCore("bogus", "<p>x</p>", actorId)).ok).toBe(false);

    const r = await updatePlatformLegalCore("terms_of_use", "<p>Platform terms.</p><script>x</script>", actorId);
    expect(r.ok).toBe(true);
    const row = await getPlatformLegal("terms_of_use");
    expect(row?.contentHtml).toContain("Platform terms.");
    expect(row?.contentHtml.toLowerCase()).not.toContain("<script");
    expect(await prisma.auditLog.count({ where: { actorUserId: actorId, action: "platform_legal.update" } })).toBeGreaterThan(0);
  });
});
