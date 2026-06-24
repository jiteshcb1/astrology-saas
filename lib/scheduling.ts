import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { computeFreeIntervals, type OverrideInput, type RuleInput, type ScheduleWithRules } from "@/lib/availability";
import { addMinutes, utcToZonedParts } from "@/lib/timezone";

// The scheduling engine (SP-3.5). getAvailableSlots computes bookable start instants (UTC) from a
// package's availability minus buffers/notice/frequency/existing bookings. reserveSlot inserts a
// booking + booking_slot atomically; the DB's GiST exclusion constraint (booking_slots_no_overlap) is
// the final arbiter against double-booking under concurrency — app code never "checks then inserts".

export interface ReserveParams {
  orgId: string;
  packageId: string;
  hostMemberId: string;
  startsAt: Date;
  durationMin: number;
  seekerUserId?: string | null;
  now?: Date;
}
export type ReserveResult =
  | { ok: true; bookingId: string; slotId: string }
  | { ok: false; reason: "slot_taken" | "too_soon" | "invalid" };

interface FreqLimit {
  per_day?: number;
  per_week?: number;
  per_month?: number;
}

// A Postgres exclusion-constraint violation (SQLSTATE 23P01) surfaces here when an overlapping slot
// loses the race. We translate it into a clean "slot taken" rather than leaking a DB error.
function isExclusionViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("booking_slots_no_overlap") ||
    msg.includes("23P01") ||
    msg.toLowerCase().includes("exclusion constraint")
  );
}

async function loadScheduleFor(orgId: string, scheduleId?: string | null): Promise<ScheduleWithRules | null> {
  const where = scheduleId ? { id: scheduleId } : { isDefault: true };
  const s = await tenantDb(orgId).availabilitySchedule.findFirst({
    where,
    include: { rules: true, overrides: true },
  });
  return s as ScheduleWithRules | null;
}

function dayKey(d: Date, tz: string): string {
  const p = utcToZonedParts(d, tz);
  return `${p.year}-${p.month}-${p.day}`;
}
function weekKey(d: Date, tz: string): string {
  const p = utcToZonedParts(d, tz);
  const days = Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
  return String(Math.floor((days + 4) / 7)); // +4 aligns the epoch (Thu) to week boundaries
}
function monthKey(d: Date, tz: string): string {
  const p = utcToZonedParts(d, tz);
  return `${p.year}-${p.month}`;
}

export async function getAvailableSlots(
  orgId: string,
  params: { packageId: string; hostMemberId: string; fromISO: string; toISO: string; durationMin?: number; now?: Date },
): Promise<Date[]> {
  const pkg = await tenantDb(orgId).package.findFirst({ where: { id: params.packageId } });
  if (!pkg || !pkg.isActive) return [];

  const duration =
    params.durationMin && pkg.allowedDurations.includes(params.durationMin)
      ? params.durationMin
      : pkg.defaultDurationMin;

  const schedule = await loadScheduleFor(orgId, pkg.scheduleId);
  if (!schedule) return [];

  const intervals = computeFreeIntervals({
    timezone: schedule.timezone,
    rules: schedule.rules as unknown as RuleInput[],
    overrides: schedule.overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      isUnavailable: o.isUnavailable,
      startTime: o.startTime,
      endTime: o.endTime,
    })) as OverrideInput[],
    fromISO: params.fromISO,
    toISO: params.toISO,
  });
  if (intervals.length === 0) return [];

  // Existing reservations for this host (active only) — the busy set.
  const busy = await tenantDb(orgId).bookingSlot.findMany({
    where: { hostMemberId: params.hostMemberId, active: true },
  });
  // Booked counts per period (for frequency caps), keyed in the schedule's timezone.
  const freq = (pkg.freqLimit ?? {}) as FreqLimit;
  const perDay = new Map<string, number>();
  const perWeek = new Map<string, number>();
  const perMonth = new Map<string, number>();
  for (const b of busy) {
    perDay.set(dayKey(b.startsAt, schedule.timezone), (perDay.get(dayKey(b.startsAt, schedule.timezone)) ?? 0) + 1);
    perWeek.set(weekKey(b.startsAt, schedule.timezone), (perWeek.get(weekKey(b.startsAt, schedule.timezone)) ?? 0) + 1);
    perMonth.set(monthKey(b.startsAt, schedule.timezone), (perMonth.get(monthKey(b.startsAt, schedule.timezone)) ?? 0) + 1);
  }
  const overFreq = (start: Date): boolean =>
    (freq.per_day != null && (perDay.get(dayKey(start, schedule.timezone)) ?? 0) >= freq.per_day) ||
    (freq.per_week != null && (perWeek.get(weekKey(start, schedule.timezone)) ?? 0) >= freq.per_week) ||
    (freq.per_month != null && (perMonth.get(monthKey(start, schedule.timezone)) ?? 0) >= freq.per_month);

  const notBefore = new Date((params.now ?? new Date()).getTime() + pkg.minNoticeMin * 60_000);
  const step = pkg.slotIntervalMin > 0 ? pkg.slotIntervalMin : 15;
  const out: Date[] = [];

  for (const interval of intervals) {
    for (let t = interval.start.getTime(); ; t += step * 60_000) {
      const start = new Date(t);
      const end = addMinutes(start, duration);
      if (end.getTime() > interval.end.getTime()) break; // doesn't fit this interval
      if (start < notBefore) continue; // minimum notice
      if (overFreq(start)) continue; // frequency cap for the period
      // Buffer-padded window must not overlap any busy reservation.
      const blockStart = addMinutes(start, -pkg.bufferBeforeMin);
      const blockEnd = addMinutes(end, pkg.bufferAfterMin);
      const clash = busy.some((b) => b.startsAt < blockEnd && b.endsAt > blockStart);
      if (!clash) out.push(start);
    }
  }
  return out;
}

export async function reserveSlot(params: ReserveParams): Promise<ReserveResult> {
  const { orgId, packageId, hostMemberId, startsAt, durationMin } = params;
  const now = params.now ?? new Date();

  const pkg = await tenantDb(orgId).package.findFirst({ where: { id: packageId } });
  if (!pkg || !pkg.isActive) return { ok: false, reason: "invalid" };
  const duration = pkg.allowedDurations.includes(durationMin) ? durationMin : pkg.defaultDurationMin;
  if (startsAt.getTime() < now.getTime() + pkg.minNoticeMin * 60_000) {
    return { ok: false, reason: "too_soon" };
  }
  const endsAt = addMinutes(startsAt, duration);

  try {
    return await tenantTransaction(async ({ db, tenant }) => {
      const booking = await tenant(orgId).booking.create({
        data: {
          packageId,
          assignedMemberId: hostMemberId,
          seekerUserId: params.seekerUserId ?? null,
          durationMin: duration,
          status: "pending_payment",
        },
      });
      // The GiST exclusion constraint rejects this insert (23P01) if it overlaps an active slot
      // for the same host — atomically, even under concurrency. No app-level check needed.
      const slot = await tenant(orgId).bookingSlot.create({
        data: { bookingId: booking.id, hostMemberId, startsAt, endsAt, active: true },
      });
      await writeAuditLog(
        { actorUserId: params.seekerUserId ?? null, action: "booking.create", resourceType: "booking", resourceId: booking.id, orgId },
        db,
      );
      return { ok: true as const, bookingId: booking.id, slotId: slot.id };
    });
  } catch (e) {
    if (isExclusionViolation(e)) return { ok: false, reason: "slot_taken" };
    throw e;
  }
}
