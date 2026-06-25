import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

// SANCTIONED super-admin cross-tenant READ path (foundation decision #6 — the "super_admin bypass
// for oversight"). This is the ONLY place outside lib/tenant-db.ts allowed to touch tenant-scoped
// models directly, and ONLY for reads (lint-exempt in eslint.config.mjs; see CLAUDE.md). Every read
// records an access entry in audit_logs. Do NOT add writes to tenant models here.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function logOversightAccess(
  actorUserId: string | null,
  resourceType: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await writeAuditLog({ actorUserId, action: "oversight.view", resourceType, metadata });
}

export async function listAllReceipts(
  actorUserId: string | null,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
) {
  const take = Math.min(Math.max(pageSize, 1), 100);
  const current = Math.max(page, 1);
  const skip = (current - 1) * take;

  const [items, total] = await Promise.all([
    prisma.receipt.findMany({
      orderBy: { issuedAt: "desc" },
      skip,
      take,
      include: { organization: { select: { name: true, slug: true } } },
    }),
    prisma.receipt.count(),
  ]);

  await logOversightAccess(actorUserId, "receipts", { page: current, pageSize: take, total });
  return { items, total, page: current, pageSize: take } satisfies Paginated<(typeof items)[number]>;
}

// ── Bookings / calls oversight (cross-tenant, read-only, audit-logged) ─────────

const BOOKING_INCLUDE = {
  organization: {
    select: {
      name: true,
      slug: true,
      consultantProfile: { select: { displayName: true, complaintsContactNumber: true, timezone: true } },
      members: {
        where: { role: "consultant" as const },
        take: 1,
        include: { user: { select: { name: true, email: true, phone: true } } },
      },
    },
  },
  package: { select: { title: true, locationType: true, price: true, currency: true } },
  payment: { select: { id: true, mode: true, amount: true, currency: true, status: true } },
  slot: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.BookingInclude;

type BookingWith = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

export interface ConsultantContact {
  name: string;
  email: string;
  contact: string;
  timezone: string;
}

// Flatten the consultant identity from org → consultantProfile + first consultant member's user.
export function resolveConsultant(org: BookingWith["organization"]): ConsultantContact {
  const user = org.members[0]?.user;
  return {
    name: org.consultantProfile?.displayName || user?.name || org.name,
    email: user?.email ?? "—",
    contact: org.consultantProfile?.complaintsContactNumber || user?.phone || "—",
    timezone: org.consultantProfile?.timezone || "Asia/Kolkata",
  };
}

export async function listAllBookings(
  actorUserId: string | null,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
) {
  const take = Math.min(Math.max(pageSize, 1), 100);
  const current = Math.max(page, 1);
  const skip = (current - 1) * take;

  const [items, total] = await Promise.all([
    prisma.booking.findMany({ orderBy: { createdAt: "desc" }, skip, take, include: BOOKING_INCLUDE }),
    prisma.booking.count(),
  ]);

  await logOversightAccess(actorUserId, "bookings", { page: current, pageSize: take, total });
  return { items, total, page: current, pageSize: take } satisfies Paginated<BookingWith>;
}

export async function getBookingDetail(actorUserId: string | null, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...BOOKING_INCLUDE,
      payment: true, // full payment record on the detail page
    },
  });
  if (!booking) return null;
  const receipt = await prisma.receipt.findFirst({ where: { bookingId } });
  await logOversightAccess(actorUserId, "booking", { bookingId, orgId: booking.organizationId });
  return { booking, receipt };
}

const BOOKING_TONES: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  confirmed: "success",
  confirming: "warning",
  pending_verification: "warning",
  pending_payment: "warning",
  held: "neutral",
  cancelled: "danger",
  expired: "neutral",
  payment_failed: "danger",
};
export function bookingStatusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  return BOOKING_TONES[status] ?? "neutral";
}
