-- CreateTable
CREATE TABLE "org_invites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_invites_tokenHash_key" ON "org_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "org_invites_organizationId_status_idx" ON "org_invites"("organizationId", "status");

-- CreateIndex
CREATE INDEX "org_invites_email_idx" ON "org_invites"("email");

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
