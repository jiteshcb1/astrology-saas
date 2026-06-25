-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "privacyPolicy" TEXT NOT NULL DEFAULT '',
    "termsConditions" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_legal" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_legal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_organizationId_key" ON "legal_documents"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_legal_docType_key" ON "platform_legal"("docType");

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
