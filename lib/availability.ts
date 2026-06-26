import type { Prisma } from "@prisma/client";
import { tenantDb, tenantTransaction } from "@/lib/tenant-db";
import { writeAuditLog } from "@/lib/audit";
import { eachDateISO, weekdayOf, zonedClockToUtc } from "@/lib/timezone";

export type ScheduleWithRules = Prisma.AvailabilityScheduleGetPayload<{
  include: { rules: true; overrides: true };
}>;

// Consultant availability (SP-3). One default "Working hours" schedule per org in Phase 1: weekly
// rules (multi-range/day) + date overrides. computeFreeIntervals is pure (UTC intervals from the
// schedule, in the schedule's timezone) and is the input to slot generation in lib/scheduling.ts.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface RuleInput {
  weekday: number; // 0=Sun … 6=Sat
  startTime: string; // "HH:mm" local to the schedule timezone
  endTime: string;
}
export interface OverrideInput {
  date: string; // "YYYY-MM-DD"
  isUnavailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
}
export interface Interval {
  start: Date; // UTC
  end: Date;
}

export type AvailabilityResult = { ok: true } | { ok: false; error: string };
export type AvailabilityFormState = { error?: string; ok?: boolean };

function validTime(s: string): boolean {
  return TIME_RE.test(s);
}

// Pure: UTC free intervals across [fromISO, toISO] for the given schedule definition.
export function computeFreeIntervals(opts: {
  timezone: string;
  rules: RuleInput[];
  overrides: OverrideInput[];
  fromISO: string;
  toISO: string;
}): Interval[] {
  const { timezone, rules, overrides, fromISO, toISO } = opts;
  const out: Interval[] = [];

  for (const iso of eachDateISO(fromISO, toISO)) {
    const dayOverrides = overrides.filter((o) => o.date === iso);
    let ranges: { startTime: string; endTime: string }[];

    if (dayOverrides.some((o) => o.isUnavailable)) {
      ranges = []; // explicitly closed this date
    } else if (dayOverrides.length > 0) {
      // Custom hours replace the weekly rules for this date.
      ranges = dayOverrides
        .filter((o) => o.startTime && o.endTime)
        .map((o) => ({ startTime: o.startTime!, endTime: o.endTime! }));
    } else {
      const wd = weekdayOf(iso);
      ranges = rules.filter((r) => r.weekday === wd);
    }

    for (const r of ranges) {
      if (!validTime(r.startTime) || !validTime(r.endTime) || r.startTime >= r.endTime) continue;
      out.push({
        start: zonedClockToUtc(iso, r.startTime, timezone),
        end: zonedClockToUtc(iso, r.endTime, timezone),
      });
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

// ── Data access + cores ───────────────────────────────────────────────────────
export async function getDefaultSchedule(orgId: string): Promise<ScheduleWithRules | null> {
  const s = await tenantDb(orgId).availabilitySchedule.findFirst({
    where: { isDefault: true },
    include: { rules: { orderBy: { weekday: "asc" } }, overrides: { orderBy: { date: "asc" } } },
  });
  return s as ScheduleWithRules | null;
}

// Per-member availability (SP-5.2). Each Consulting member (owner included) has their own schedule keyed by
// ownerMemberId. Back-compat: the owner falls back to the legacy default schedule (ownerMemberId null) so
// existing single-consultant orgs keep working; a non-owner with no own schedule has no availability.
export async function getMemberSchedule(orgId: string, memberId: string, isOwner: boolean): Promise<ScheduleWithRules | null> {
  const own = await tenantDb(orgId).availabilitySchedule.findFirst({
    where: { ownerMemberId: memberId },
    include: { rules: { orderBy: { weekday: "asc" } }, overrides: { orderBy: { date: "asc" } } },
  });
  if (own) return own as ScheduleWithRules;
  if (isOwner) {
    const legacy = await tenantDb(orgId).availabilitySchedule.findFirst({
      where: { isDefault: true, ownerMemberId: null },
      include: { rules: { orderBy: { weekday: "asc" } }, overrides: { orderBy: { date: "asc" } } },
    });
    if (legacy) return legacy as ScheduleWithRules;
  }
  return null;
}

export async function saveAvailabilityCore(
  orgId: string,
  memberId: string,
  isOwner: boolean,
  input: { timezone: string; rules: RuleInput[]; overrides: OverrideInput[] },
  actorUserId: string,
): Promise<AvailabilityResult> {
  // Validation (defense — the UI also constrains).
  for (const r of input.rules) {
    if (r.weekday < 0 || r.weekday > 6) return { ok: false, error: "Invalid weekday." };
    if (!validTime(r.startTime) || !validTime(r.endTime) || r.startTime >= r.endTime) {
      return { ok: false, error: "Each range needs a start before its end (HH:mm)." };
    }
  }
  for (const o of input.overrides) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return { ok: false, error: "Invalid override date." };
    if (!o.isUnavailable && o.startTime && o.endTime && o.startTime >= o.endTime) {
      return { ok: false, error: "Override hours need a start before its end." };
    }
  }
  if (!input.timezone.trim()) return { ok: false, error: "Choose a timezone." };

  await tenantTransaction(async ({ db, tenant }) => {
    // The member's own schedule (ownerMemberId). Owner may adopt the legacy default in place.
    let schedule = await tenant(orgId).availabilitySchedule.findFirst({ where: { ownerMemberId: memberId } });
    if (!schedule && isOwner) {
      const legacy = await tenant(orgId).availabilitySchedule.findFirst({ where: { isDefault: true, ownerMemberId: null } });
      if (legacy) {
        await tenant(orgId).availabilitySchedule.updateMany({ where: { id: legacy.id }, data: { ownerMemberId: memberId, timezone: input.timezone.trim() } });
        schedule = legacy;
      }
    }
    if (!schedule) {
      schedule = await tenant(orgId).availabilitySchedule.create({
        data: { name: "Working hours", timezone: input.timezone.trim(), isDefault: isOwner, ownerMemberId: memberId },
      });
    } else {
      await tenant(orgId).availabilitySchedule.updateMany({
        where: { id: schedule.id },
        data: { timezone: input.timezone.trim() },
      });
    }
    const scheduleId = schedule.id;

    // Replace rules + overrides wholesale (simplest correct semantics for a small set).
    await tenant(orgId).availabilityRule.deleteMany({ where: { scheduleId } });
    await tenant(orgId).availabilityOverride.deleteMany({ where: { scheduleId } });
    if (input.rules.length) {
      await tenant(orgId).availabilityRule.createMany({
        data: input.rules.map((r) => ({ scheduleId, weekday: r.weekday, startTime: r.startTime, endTime: r.endTime })),
      });
    }
    if (input.overrides.length) {
      await tenant(orgId).availabilityOverride.createMany({
        data: input.overrides.map((o) => ({
          scheduleId,
          date: new Date(`${o.date}T00:00:00.000Z`),
          isUnavailable: o.isUnavailable,
          startTime: o.isUnavailable ? null : o.startTime ?? null,
          endTime: o.isUnavailable ? null : o.endTime ?? null,
        })),
      });
    }

    await writeAuditLog(
      { actorUserId, action: "availability.update", resourceType: "availability_schedule", resourceId: scheduleId, orgId, metadata: { memberId } },
      db,
    );
  });
  return { ok: true };
}
