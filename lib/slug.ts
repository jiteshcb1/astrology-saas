// Slug rules for consultant orgs (public booking URL = platform.com/<slug>).
// Phase 1: slugs are validated on creation and IMMUTABLE thereafter (no rename / redirects).

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "auth",
  "signin",
  "signout",
  "post-auth",
  "superadmin",
  "admin",
  "dashboard",
  "app",
  "www",
  "static",
  "assets",
  "health",
  "login",
  "logout",
  "settings",
  "account",
  "billing",
  "consultants",
  "onboarding",
  "new",
  "edit",
  "public",
  "_next",
]);

// Lowercase, 3–40 chars, alphanumeric + hyphen, no leading/trailing hyphen.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export type SlugValidation = { ok: true } | { ok: false; error: string };

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function validateSlug(input: string): SlugValidation {
  const slug = normalizeSlug(input);
  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "Slug must be 3–40 characters: lowercase letters, numbers or hyphens, not starting or ending with a hyphen.",
    };
  }
  if (slug.includes("--")) {
    return { ok: false, error: "Slug cannot contain consecutive hyphens." };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "That slug is reserved. Please choose another." };
  }
  return { ok: true };
}
