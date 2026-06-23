-- CreateTable
CREATE TABLE "org_branding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoKey" TEXT,
    "themeColor" TEXT,
    "fontKey" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "org_branding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_branding_organizationId_key" ON "org_branding"("organizationId");

-- AddForeignKey
ALTER TABLE "org_branding" ADD CONSTRAINT "org_branding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
