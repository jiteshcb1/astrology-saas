// SP-6.2 — seed the platform-owned demo consultant ("Pandit Demo Sharma").
// Idempotent: if the demo org already exists we no-op (seed-once; never modify/delete it).
// Reuses the production cores (no raw tenant writes) so the demo data is built exactly like a real org.
// Run with: npm run seed:demo  (→ node --env-file=.env.local tsx prisma/seeds/demo.ts)
import { pathToFileURL } from "node:url";
import { prisma } from "../../lib/db";
import { tenantDb } from "../../lib/tenant-db";
import { createConsultantCore } from "../../lib/consultants";
import { completeOnboardingCore, updateProfileCore } from "../../lib/consultant-profile";
import { saveAvailabilityCore, getDefaultSchedule } from "../../lib/availability";
import { savePackageCore, type PackageInput } from "../../lib/packages";
import { saveUpiCore } from "../../lib/payments";
import { updateBrandingCore } from "../../lib/branding";

const SLUG = "pandit-demo-sharma";

// Unwrap a core result, throwing its error so a partial seed fails loudly.
function must<T extends { ok: boolean }>(label: string, r: T): T {
  if (!r.ok) throw new Error(`[seed:demo] ${label}: ${(r as { error?: string }).error ?? "failed"}`);
  return r;
}

export async function seedDemo(): Promise<{ orgId: string; created: boolean }> {
  const existing = await prisma.organization.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`[seed:demo] already seeded (org ${existing.id} → /${SLUG}) — no-op`);
    return { orgId: existing.id, created: false };
  }

  const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  if (!superAdmin) throw new Error("[seed:demo] no super_admin found — run `npm run prisma:seed` first");
  const actor = superAdmin.id;

  // 1) Org + owner user + OrgMember, then flag it as the demo org.
  const created = must(
    "createConsultant",
    await createConsultantCore(
      { orgName: "Pandit Demo Sharma", slug: SLUG, ownerName: "Pandit Demo Sharma", ownerEmail: "demo@hifiai.in" },
      actor,
    ),
  ) as { ok: true; orgId: string };
  const orgId = created.orgId;
  await prisma.organization.update({ where: { id: orgId }, data: { isDemoOrg: true } });

  // 2) Profile — onboarding basics, then the rich public profile.
  must("onboarding", await completeOnboardingCore(orgId, { displayName: "Pandit Demo Sharma", businessType: "Vedic Astrology", timezone: "Asia/Kolkata" }, actor));
  must(
    "profile",
    await updateProfileCore(
      orgId,
      {
        displayName: "Pandit Demo Sharma",
        bio: "Guiding seekers with Vedic wisdom for over 18 years — with clarity, compassion, and care.",
        experience:
          "Pandit Demo Sharma has spent more than 18 years studying the classical texts of Jyotish and counselling thousands of seekers across India and abroad. His readings blend traditional Vedic methods with practical, down-to-earth guidance — whether you're navigating career decisions, relationships, or life's bigger questions.",
        specialities: ["Vedic Astrology", "Kundali Analysis", "Numerology", "Palmistry", "Vastu"],
        socialLinks: { instagram: "https://instagram.com/panditdemosharma", youtube: "https://youtube.com/@panditdemosharma" },
        gstNumber: "",
        gstLegalName: "",
        complaintsContactNumber: "+91 98765 43210",
      },
      actor,
    ),
  );

  // 3) Availability — the owner member, Mon–Sat 09:00–18:00 IST.
  const ownerMember = await tenantDb(orgId).orgMember.findFirst();
  if (!ownerMember) throw new Error("[seed:demo] owner member missing after createConsultant");
  const rules = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "09:00", endTime: "18:00" }));
  must("availability", await saveAvailabilityCore(orgId, ownerMember.id, true, { timezone: "Asia/Kolkata", rules, overrides: [] }, actor));

  // 4) Three packages with varied duration + price (paise), linked to the default schedule.
  const sched = await getDefaultSchedule(orgId);
  const base: Omit<PackageInput, "title" | "slug" | "description" | "allowedDurations" | "defaultDurationMin" | "price"> = {
    allowBookerChooseDuration: false,
    bufferBeforeMin: 10,
    bufferAfterMin: 10,
    minNoticeMin: 120,
    slotIntervalMin: 30,
    freqLimit: {},
    scheduleId: sched?.id ?? null,
  };
  must("pkg:kundali", await savePackageCore(orgId, { ...base, title: "Kundali Reading", slug: "kundali-reading", description: "A complete birth-chart analysis covering career, health, and relationships.", allowedDurations: [60], defaultDurationMin: 60, price: 150000 }, actor));
  must("pkg:career", await savePackageCore(orgId, { ...base, title: "Career Guidance", slug: "career-guidance", description: "Focused guidance on your professional path and upcoming opportunities.", allowedDurations: [30], defaultDurationMin: 30, price: 75100 }, actor));
  must("pkg:relationship", await savePackageCore(orgId, { ...base, title: "Relationship Consultation", slug: "relationship-consultation", description: "Compatibility, timing, and remedies for matters of the heart.", allowedDurations: [45], defaultDurationMin: 45, price: 110000 }, actor));

  // 5) Payment — UPI QR (placeholder key; dev getSignedUrl returns a stub URL, no upload needed).
  must("upi", await saveUpiCore(orgId, { upiVpa: "panditdemo@upi", qrImageKey: "demo/qr/pandit-demo.png" }, actor));

  // 6) Branding — midnight indigo theme, Fraunces, starfield background.
  must("branding", await updateBrandingCore(orgId, { themeColor: "#14122b", fontKey: "fraunces", defaultLocale: "en", backgroundStyle: "stars_zodiac", logoKey: null }, actor));

  console.log(`[seed:demo] ✓ seeded demo org ${orgId} → /${SLUG}`);
  return { orgId, created: true };
}

// Run only when invoked directly (npm run seed:demo) — not on import (tests import seedDemo).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
