import { redirect } from "next/navigation";
import { requireSection } from "@/lib/rbac";
import { getProfile } from "@/lib/consultant-profile";
import { getMemberSchedule } from "@/lib/availability";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { AvailabilityEditor, type OverrideState } from "@/components/dashboard/AvailabilityEditor";

// SP-5.2/5.3: per-member availability (consultant owner + team_consulting only; requireSection 404s others).
export default async function AvailabilityPage() {
  const { orgId, memberId, role } = await requireSection("availability");
  const isOwner = role === "consultant";
  if (isOwner) {
    const profile = await getProfile(orgId);
    if (!profile?.onboardedAt) redirect("/onboarding");
  }

  const schedule = await getMemberSchedule(orgId, memberId, isOwner);

  const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const ranges = (schedule?.rules ?? [])
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ start: r.startTime, end: r.endTime }));
    if (!schedule) {
      // First-time default: Mon–Fri 09:00–17:00.
      return { weekday, enabled: weekday >= 1 && weekday <= 5, ranges: [{ start: "09:00", end: "17:00" }] };
    }
    return { weekday, enabled: ranges.length > 0, ranges: ranges.length ? ranges : [{ start: "09:00", end: "17:00" }] };
  });

  const overrides: OverrideState[] = (schedule?.overrides ?? []).map((o) => ({
    date: o.date.toISOString().slice(0, 10),
    isUnavailable: o.isUnavailable,
    start: o.startTime ?? "09:00",
    end: o.endTime ?? "17:00",
  }));

  const defaults = { timezone: schedule?.timezone ?? "Asia/Kolkata", week, overrides };

  return (
    <>
      <PageHeader title="Availability" subtitle="Your hours — when you're open for bookings" />
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <AvailabilityEditor defaults={defaults} />
      </div>
    </>
  );
}
