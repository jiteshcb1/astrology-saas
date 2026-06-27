-- CreateTable
CREATE TABLE "calendar_integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orgMemberId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "calendarId" TEXT,
    "googleEmail" TEXT,
    "connectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_integrations_orgMemberId_key" ON "calendar_integrations"("orgMemberId");

-- CreateIndex
CREATE INDEX "calendar_integrations_organizationId_idx" ON "calendar_integrations"("organizationId");

-- AddForeignKey
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_integrations" ADD CONSTRAINT "calendar_integrations_orgMemberId_fkey" FOREIGN KEY ("orgMemberId") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
