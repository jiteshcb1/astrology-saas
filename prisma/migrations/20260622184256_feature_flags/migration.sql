-- CreateEnum
CREATE TYPE "FlagScope" AS ENUM ('global', 'plan', 'org');

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "FlagScope" NOT NULL,
    "scopeId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_flags_scope_scopeId_idx" ON "feature_flags"("scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_scope_scopeId_key" ON "feature_flags"("key", "scope", "scopeId");
