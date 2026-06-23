-- CreateTable
CREATE TABLE "consultant_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT,
    "businessType" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "bio" TEXT,
    "experience" TEXT,
    "specialities" TEXT[],
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "gstNumber" TEXT,
    "gstLegalName" TEXT,
    "complaintsContactNumber" TEXT,
    "onboardedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consultant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultant_profiles_organizationId_key" ON "consultant_profiles"("organizationId");

-- AddForeignKey
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
