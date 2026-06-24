-- CreateTable
CREATE TABLE "availability_schedules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerMemberId" TEXT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isUnavailable" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "allowedDurations" INTEGER[],
    "defaultDurationMin" INTEGER NOT NULL DEFAULT 30,
    "allowBookerChooseDuration" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "locationType" TEXT NOT NULL DEFAULT 'google_meet',
    "scheduleId" TEXT,
    "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
    "minNoticeMin" INTEGER NOT NULL DEFAULT 0,
    "slotIntervalMin" INTEGER NOT NULL DEFAULT 15,
    "freqLimit" JSONB NOT NULL DEFAULT '{}',
    "assignmentMode" TEXT NOT NULL DEFAULT 'round_robin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seekerUserId" TEXT,
    "packageId" TEXT NOT NULL,
    "assignedMemberId" TEXT,
    "durationMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "tosAcceptedAt" TIMESTAMPTZ(6),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "meetLink" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hostMemberId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_schedules_organizationId_idx" ON "availability_schedules"("organizationId");

-- CreateIndex
CREATE INDEX "availability_rules_scheduleId_idx" ON "availability_rules"("scheduleId");

-- CreateIndex
CREATE INDEX "availability_overrides_scheduleId_idx" ON "availability_overrides"("scheduleId");

-- CreateIndex
CREATE INDEX "packages_organizationId_idx" ON "packages"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "packages_organizationId_slug_key" ON "packages"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "bookings_organizationId_status_idx" ON "bookings"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_slots_bookingId_key" ON "booking_slots"("bookingId");

-- CreateIndex
CREATE INDEX "booking_slots_hostMemberId_idx" ON "booking_slots"("hostMemberId");

-- AddForeignKey
ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "availability_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "availability_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "availability_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seekerUserId_fkey" FOREIGN KEY ("seekerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── No-double-book invariant (SP-3) ─────────────────────────────────────────
-- GiST exclusion: for a given host, no two ACTIVE booking_slots may have overlapping time ranges.
-- Enforced by the database, not app logic — survives concurrency (the second of two overlapping
-- inserts raises SQLSTATE 23P01). btree_gist provides the "=" operator class for the scalar
-- host column inside a GiST index. The range expression handles variable durations natively.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "booking_slots_no_overlap"
  EXCLUDE USING gist (
    "hostMemberId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("active");
