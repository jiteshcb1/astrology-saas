import type { Prisma } from "@prisma/client";
import { tenantDb } from "@/lib/tenant-db";
import { utcToZonedParts } from "@/lib/timezone";

// SP-5.3: a Consulting member's OWN assigned bookings (assignedMemberId = their OrgMember id). Seeker
// name/contact + package + slot + meetLink only — NEVER payment amounts (financial data is Accounts-only).

export interface MemberBooking {
  id: string;
  seekerName: string | null;
  seekerEmail: string | null;
  seekerPhone: string | null;
  packageTitle: string;
  startsAt: Date | null;
  endsAt: Date | null;
  durationMin: number;
  status: string;
  meetLink: string | null;
}

type Row = Prisma.BookingGetPayload<{ include: { package: { select: { title: true } }; slot: { select: { startsAt: true; endsAt: true } } } }>;

export async function listMemberBookings(orgId: string, memberId: string): Promise<MemberBooking[]> {
  const rows = (await tenantDb(orgId).booking.findMany({
    where: { assignedMemberId: memberId, status: { in: ["confirmed", "pending_verification"] } },
    include: { package: { select: { title: true } }, slot: { select: { startsAt: true, endsAt: true } } },
    orderBy: { createdAt: "desc" },
  })) as Row[];
  return rows.map((b) => ({
    id: b.id,
    seekerName: b.seekerName,
    seekerEmail: b.seekerEmail,
    seekerPhone: b.seekerPhone,
    packageTitle: b.package.title,
    startsAt: b.slot?.startsAt ?? null,
    endsAt: b.slot?.endsAt ?? null,
    durationMin: b.durationMin,
    status: b.status,
    meetLink: b.meetLink,
  }));
}

export interface MemberStats {
  today: number;
  thisWeek: number;
  totalCompleted: number;
  upcomingThisMonth: number;
}

export async function getMemberDashboard(orgId: string, memberId: string, now: Date = new Date(), tz = "Asia/Kolkata") {
  const all = (await listMemberBookings(orgId, memberId)).filter((b) => b.startsAt);
  const upcoming = all.filter((b) => b.startsAt!.getTime() >= now.getTime()).sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());
  const past = all.filter((b) => b.startsAt!.getTime() < now.getTime()).sort((a, b) => b.startsAt!.getTime() - a.startsAt!.getTime());

  const nowP = utcToZonedParts(now, tz);
  const sameDay = (d: Date) => {
    const p = utcToZonedParts(d, tz);
    return p.year === nowP.year && p.month === nowP.month && p.day === nowP.day;
  };
  const sameMonth = (d: Date) => {
    const p = utcToZonedParts(d, tz);
    return p.year === nowP.year && p.month === nowP.month;
  };
  const stats: MemberStats = {
    today: upcoming.filter((b) => sameDay(b.startsAt!)).length,
    thisWeek: upcoming.filter((b) => b.startsAt!.getTime() <= now.getTime() + 7 * 86_400_000).length,
    totalCompleted: past.filter((b) => b.status === "confirmed").length,
    upcomingThisMonth: upcoming.filter((b) => sameMonth(b.startsAt!)).length,
  };
  return { stats, upcoming, past };
}
