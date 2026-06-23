-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('consultation', 'subscription');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "pastDueSince" TIMESTAMPTZ(6),
ADD COLUMN     "suspendedForNonpayment" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "bookingId" TEXT,
    "issuedTo" TEXT NOT NULL,
    "gstNumberUsed" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "gatewayEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipts_organizationId_type_idx" ON "receipts"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_gatewayEventId_key" ON "billing_events"("gatewayEventId");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
