"use server";

import { getActiveOrgBySlug } from "@/lib/public-page";
import { getAvailableSlots } from "@/lib/scheduling";

// Public slot fetch for the booking page. Re-resolves the ACTIVE org by slug (so a suspended org stops
// returning slots) and runs the scheduling engine scoped to that org. Returns UTC ISO strings; the
// client renders them in the seeker's timezone. Unauthenticated + scoped strictly to the slug's org.
export async function getPublicSlotsAction(
  slug: string,
  packageId: string,
  durationMin: number,
  fromISO: string,
  toISO: string,
): Promise<string[]> {
  const data = await getActiveOrgBySlug(slug);
  if (!data || !data.hostMemberId) return [];
  const slots = await getAvailableSlots(data.orgId, {
    packageId,
    hostMemberId: data.hostMemberId,
    fromISO,
    toISO,
    durationMin,
  });
  return slots.map((d) => d.toISOString());
}
