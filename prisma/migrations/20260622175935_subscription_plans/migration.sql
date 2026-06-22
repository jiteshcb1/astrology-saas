-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "includedSeats" INTEGER NOT NULL DEFAULT 1,
    "perSeatPrice" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMPTZ(6),
    "gatewaySubscriptionRef" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_orgId_key" ON "subscriptions"("orgId");

-- CreateIndex
CREATE INDEX "subscriptions_planId_idx" ON "subscriptions"("planId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
