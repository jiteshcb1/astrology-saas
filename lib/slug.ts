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
  "legal",
  "privacy",
  "terms",
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

// Real-time, typing-tolerant evaluation for the slug input field. Gives leading-hyphen and
// min-length their own messages, and tolerates a trailing hyphen mid-typing (trimmed on blur).
// Pure → unit-tested. `display` is what to show in the field; `canonical` is what to submit/check.
export interface SlugInputEval {
  display: string;
  canonical: string;
  status: "empty" | "error" | "ok";
  message?: string; // blocking error
  note?: string; // non-blocking info (e.g. a hyphen was trimmed)
}

export function evaluateSlugInput(raw: string, opts: { typing?: boolean } = {}): SlugInputEval {
  const typing = opts.typing ?? false;
  const lowered = (raw ?? "").toLowerCase();
  // Spaces and any other disallowed characters become hyphens as the user types (runs collapse to a
  // single hyphen) — so the field always holds a valid slug shape instead of rejecting input.
  const hadInvalidChars = /[^a-z0-9-]/.test(lowered);
  const replaced = lowered.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  const hadLeadingHyphen = /^-/.test(replaced);
  const display = replaced.replace(/^-+/, ""); // leading hyphens are never valid → trim live
  const hadTrailingHyphen = /-$/.test(display);
  const canonical = display.replace(/-+$/, "");
  const note = hadInvalidChars
    ? "Spaces and symbols become hyphens."
    : hadLeadingHyphen
      ? "Slugs can't start with a hyphen — removed it."
      : undefined;

  if (display.length === 0) return { display, canonical, status: "empty", note };
  // A trailing hyphen is fine mid-typing (e.g. "jyoti-" on the way to "jyoti-astro"); trimmed on blur.
  if (hadTrailingHyphen && typing) return { display, canonical, status: "empty", note };
  if (canonical.length < 3)
    return { display, canonical, status: "error", message: "Slug must be at least 3 characters.", note };
  if (RESERVED_SLUGS.has(canonical))
    return { display, canonical, status: "error", message: "That slug is reserved.", note };

  return {
    display,
    canonical,
    status: "ok",
    note: hadTrailingHyphen && !typing ? "Removed trailing hyphen." : note,
  };
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
