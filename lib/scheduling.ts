import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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

// How long a slot is held while the seeker fills details + pays (SP-4.2/4.3).
export const HOLD_MINUTES = 10;

// Booking statuses, grouped for the hold lifecycle. LIVE = permanently blocks the slot; HOLD = blocks
// only while the hold window is open (holdExpiresAt > now), otherwise it's an expired hold (frees lazily).
// pending_verification (UPI proof submitted, awaiting consultant) holds the slot like a confirmed booking.
const LIVE_STATUSES = new Set(["confirmed", "confirming", "pending_verification"]);
const HOLD_STATUSES = new Set(["held", "pending_payment"]);
type BookingState = { status: string; holdExpiresAt: Date | null };
// The generic tenant facade doesn't narrow `include`, so type slot+booking payloads explicitly.
type SlotWithBooking = Prisma.BookingSlotGetPayload<{ include: { booking: { select: { status: true; holdExpiresAt: true } } } }>;

function isBlocking(b: BookingState | null | undefined, now: Date): boolean {
  if (!b) return true; // a slot with no readable booking is treated as blocking (safe default)
  if (LIVE_STATUSES.has(b.status)) return true;
  if (HOLD_STATUSES.has(b.status)) return b.holdExpiresAt != null && b.holdExpiresAt.getTime() > now.getTime();
  return false; // expired / cancelled / unknown → does not block
}
function isExpiredHold(b: BookingState | null | undefined, now: Date): boolean {
  if (!b) return false;
  return HOLD_STATUSES.has(b.status) && (b.holdExpiresAt == null || b.holdExpiresAt.getTime() <= now.getTime());
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

  // Existing reservations for this host (active only) — the busy set. Expired-but-unswept holds are
  // joined and filtered out so they neither block slots nor count toward frequency caps.
  const nowForBusy = params.now ?? new Date();
  const busyRows = (await tenantDb(orgId).bookingSlot.findMany({
    where: { hostMemberId: params.hostMemberId, active: true },
    include: { booking: { select: { status: true, holdExpiresAt: true } } },
  })) as SlotWithBooking[];
  const busy = busyRows.filter((s) => isBlocking(s.booking, nowForBusy));
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
  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);

  // Atomic hold: the GiST exclusion constraint rejects this insert (23P01) if it overlaps an active
  // slot for the same host — even under concurrency. No app-level "check then insert".
  const insertHold = () =>
    tenantTransaction(async ({ db, tenant }) => {
      const booking = await tenant(orgId).booking.create({
        data: {
          packageId,
          assignedMemberId: hostMemberId,
          seekerUserId: params.seekerUserId ?? null,
          durationMin: duration,
          status: "held",
          holdExpiresAt,
        },
      });
      const slot = await tenant(orgId).bookingSlot.create({
        data: { bookingId: booking.id, hostMemberId, startsAt, endsAt, active: true },
      });
      await writeAuditLog(
        { actorUserId: params.seekerUserId ?? null, action: "booking.hold", resourceType: "booking", resourceId: booking.id, orgId },
        db,
      );
      return { ok: true as const, bookingId: booking.id, slotId: slot.id };
    });

  try {
    return await insertHold();
  } catch (e) {
    if (!isExclusionViolation(e)) throw e;
    // Lazy expiry: if the only thing in the way is an EXPIRED hold, free it and retry once.
    const freed = await freeExpiredOverlaps(orgId, hostMemberId, startsAt, endsAt, now);
    if (!freed) return { ok: false, reason: "slot_taken" };
    try {
      return await insertHold();
    } catch (e2) {
      if (isExclusionViolation(e2)) return { ok: false, reason: "slot_taken" };
      throw e2;
    }
  }
}

// Deactivate any overlapping EXPIRED holds for this host so a fresh hold can take the slot. Returns
// false (don't retry) if a LIVE booking blocks the window or there's nothing expired to free.
async function freeExpiredOverlaps(
  orgId: string,
  hostMemberId: string,
  startsAt: Date,
  endsAt: Date,
  now: Date,
): Promise<boolean> {
  const overlaps = (await tenantDb(orgId).bookingSlot.findMany({
    where: { hostMemberId, active: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    include: { booking: { select: { status: true, holdExpiresAt: true } } },
  })) as SlotWithBooking[];
  if (overlaps.some((s) => isBlocking(s.booking, now))) return false; // a real/live booking holds it
  const expired = overlaps.filter((s) => isExpiredHold(s.booking, now));
  if (expired.length === 0) return false;
  await tenantTransaction(async ({ tenant }) => {
    await tenant(orgId).bookingSlot.updateMany({ where: { id: { in: expired.map((s) => s.id) } }, data: { active: false } });
    await tenant(orgId).booking.updateMany({
      where: { id: { in: expired.map((s) => s.bookingId) }, status: { in: ["held", "pending_payment"] } },
      data: { status: "expired" },
    });
  });
  return true;
}

// Sweep (cron housekeeping): expire unpaid holds whose window has lapsed, freeing their slots. Skips
// "confirming"/"confirmed", so a mid-payment hold is never freed. Per-org scoped (no bare tenant access).
export async function expireHoldsCore(now: Date = new Date(), onlyOrgId?: string): Promise<{ expired: number }> {
  const orgs = onlyOrgId ? [{ id: onlyOrgId }] : await prisma.organization.findMany({ select: { id: true } });
  let expired = 0;
  for (const { id: orgId } of orgs) {
    const stale = await tenantDb(orgId).booking.findMany({
      where: { status: { in: ["held", "pending_payment"] }, holdExpiresAt: { lt: now } },
      select: { id: true },
    });
    if (stale.length === 0) continue;
    const ids = stale.map((b) => b.id);
    await tenantTransaction(async ({ tenant }) => {
      await tenant(orgId).bookingSlot.updateMany({ where: { bookingId: { in: ids }, active: true }, data: { active: false } });
      await tenant(orgId).booking.updateMany({
        where: { id: { in: ids }, status: { in: ["held", "pending_payment"] } },
        data: { status: "expired" },
      });
    });
    expired += ids.length;
  }
  return { expired };
}

// Compare-and-swap claim used by SP-4.3 payment confirmation. Transitions a still-valid hold to
// "confirming" atomically; returns ok:false if the hold already expired/was swept (don't charge).
// Mutually exclusive with expireHoldsCore via the conditional WHERE on status (row-level lock serializes).
export async function claimHoldForPayment(
  orgId: string,
  bookingId: string,
  now: Date = new Date(),
): Promise<{ ok: boolean }> {
  const res = await tenantDb(orgId).booking.updateMany({
    where: { id: bookingId, status: { in: ["held", "pending_payment"] }, holdExpiresAt: { gt: now } },
    data: { status: "confirming" },
  });
  return { ok: res.count === 1 };
}
