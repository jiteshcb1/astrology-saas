"use server";

import { slugAvailabilityCore } from "@/lib/consultants";

// Public (unauthenticated) availability check for the home "claim your jyoti.app address" field.
// Reuses the canonical org-slug check (validates format + looks up organizations.slug). Slugs are public
// booking URLs, so exposing availability is not sensitive.
export async function checkClaimAvailabilityAction(slug: string): Promise<{ available: boolean; reason?: string }> {
  return slugAvailabilityCore(slug);
}
