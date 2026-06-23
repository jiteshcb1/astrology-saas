import type { Prisma } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";

// Consultant public profile + onboarding state. Tenant-scoped via tenantDb(orgId).consultantProfile.
// Pure validators are unit-tested; cores run through tenantTransaction + writeAuditLog.

// Indian GSTIN: 2-digit state, 5 letters, 4 digits, 1 letter, 1 alnum, 'Z', 1 alnum.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,15}$/;

// Curated specialities for the multiselect (consultant profile).
export const SPECIALITY_OPTIONS = [
  "Kundali Reading",
  "Career & Finance",
  "Marriage & Matchmaking",
  "Vastu",
  "Numerology",
  "Tarot",
  "Palmistry",
  "Gemstone Consultation",
  "Muhurat / Auspicious Timing",
  "Health & Wellness",
  "Relationships",
  "Business Astrology",
  "Horoscope / Birth Chart",
  "Remedies & Rituals",
];

export function isValidGstin(s: string): boolean {
  return GSTIN_RE.test(s.trim().toUpperCase());
}

export function isValidPhone(s: string): boolean {
  return PHONE_RE.test(s.trim());
}

export function parseSpecialities(csv: string): string[] {
  const seen = new Set<string>();
  for (const raw of (csv ?? "").split(",")) {
    const v = raw.trim();
    if (v) seen.add(v);
  }
  return [...seen];
}

export function buildSocialLinks(input: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const v = (value ?? "").trim();
    if (v) out[key] = v;
  }
  return out;
}

export type ProfileResult = { ok: true } | { ok: false; error: string };
export type ProfileFormState = { error?: string; ok?: boolean };

export async function getProfile(orgId: string) {
  return tenantDb(orgId).consultantProfile.findFirst();
}

export interface OnboardingInput {
  displayName: string;
  businessType: string;
  timezone: string;
}

export async function completeOnboardingCore(
  orgId: string,
  input: OnboardingInput,
  actorUserId: string,
): Promise<ProfileResult> {
  if (!input.displayName.trim()) return { ok: false, error: "Display name is required." };
  const data = {
    displayName: input.displayName.trim(),
    businessType: input.businessType.trim() || null,
    timezone: input.timezone.trim() || "Asia/Kolkata",
    onboardedAt: new Date(),
  };
  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).consultantProfile.findFirst();
    if (existing) {
      await tenant(orgId).consultantProfile.updateMany({ data });
    } else {
      await tenant(orgId).consultantProfile.create({ data });
    }
    await writeAuditLog(
      { actorUserId, action: "profile.onboard", resourceType: "consultant_profile", resourceId: orgId, orgId },
      db,
    );
  });
  return { ok: true };
}

export interface ProfileInput {
  displayName: string;
  bio: string;
  experience: string;
  specialities: string[];
  socialLinks: Record<string, string>;
  gstNumber: string;
  gstLegalName: string;
  complaintsContactNumber: string;
}

export async function updateProfileCore(
  orgId: string,
  input: ProfileInput,
  actorUserId: string,
): Promise<ProfileResult> {
  // Required: personal details + contact. Optional: social links, GST.
  if (!input.displayName.trim()) return { ok: false, error: "Display name is required." };
  if (!input.bio.trim()) return { ok: false, error: "Bio is required." };
  if (!input.experience.trim()) return { ok: false, error: "Experience is required." };
  if (input.specialities.length === 0) return { ok: false, error: "Select at least one speciality." };
  if (!input.complaintsContactNumber.trim()) return { ok: false, error: "Contact number is required." };
  if (!isValidPhone(input.complaintsContactNumber)) {
    return { ok: false, error: "Enter a valid contact phone number." };
  }
  // GST is optional; validate only if provided. (Business legal name will be auto-filled from the
  // GST identification API later — TODO(GST API).)
  if (input.gstNumber.trim() && !isValidGstin(input.gstNumber)) {
    return { ok: false, error: "Enter a valid 15-character GSTIN." };
  }

  const data = {
    displayName: input.displayName.trim() || null,
    bio: input.bio.trim() || null,
    experience: input.experience.trim() || null,
    specialities: input.specialities,
    socialLinks: input.socialLinks as Prisma.InputJsonValue,
    gstNumber: input.gstNumber.trim() ? input.gstNumber.trim().toUpperCase() : null,
    gstLegalName: input.gstLegalName.trim() || null,
    complaintsContactNumber: input.complaintsContactNumber.trim() || null,
  };

  await tenantTransaction(async ({ db, tenant }) => {
    const existing = await tenant(orgId).consultantProfile.findFirst();
    if (existing) {
      await tenant(orgId).consultantProfile.updateMany({ data });
    } else {
      await tenant(orgId).consultantProfile.create({ data });
    }
    await writeAuditLog(
      { actorUserId, action: "profile.update", resourceType: "consultant_profile", resourceId: orgId, orgId },
      db,
    );
  });
  return { ok: true };
}
