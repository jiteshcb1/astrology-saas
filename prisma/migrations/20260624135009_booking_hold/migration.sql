-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "holdExpiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "seekerEmail" TEXT,
ADD COLUMN     "seekerName" TEXT,
ADD COLUMN     "seekerPhone" TEXT,
ALTER COLUMN "status" SET DEFAULT 'held';

-- CreateTable
CREATE TABLE "package_questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL DEFAULT 'short_text',
    "requirement" TEXT NOT NULL DEFAULT 'optional',
    "options" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_questions_packageId_idx" ON "package_questions"("packageId");

-- AddForeignKey
ALTER TABLE "package_questions" ADD CONSTRAINT "package_questions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
