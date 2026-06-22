// Super-admin bootstrap policy. The first (and only seeded) super admin is provisioned by the
// operator-run seed, keyed to SUPERADMIN_EMAIL — never via self-service sign-in. In production we
// refuse the dev placeholder / an unset value so we never ship a dead or guessable admin row.

export const DEV_SUPERADMIN_EMAIL = "admin@astro.local";

export function resolveSuperadminEmail(
  envValue: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const value = (envValue ?? "").trim().toLowerCase();
  if (nodeEnv === "production") {
    if (!value || value === DEV_SUPERADMIN_EMAIL) {
      throw new Error(
        "SUPERADMIN_EMAIL must be set to a real address in production (the dev placeholder is rejected).",
      );
    }
    return value;
  }
  return value || DEV_SUPERADMIN_EMAIL;
}
