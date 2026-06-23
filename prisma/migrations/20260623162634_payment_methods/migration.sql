-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "upiVpa" TEXT,
    "qrImageKey" TEXT,
    "gatewayProvider" TEXT,
    "connectionType" TEXT NOT NULL DEFAULT 'manual_keys',
    "gatewayKeyIdEnc" TEXT,
    "gatewayKeySecretEnc" TEXT,
    "gatewayKeyIdLast4" TEXT,
    "oauthTokenEnc" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_organizationId_key" ON "payment_methods"("organizationId");

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
