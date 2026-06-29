-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'admin_provisioned';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "coachingSeen" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "signup_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "requestIp" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signup_attempts_email_createdAt_idx" ON "signup_attempts"("email", "createdAt");

-- CreateIndex
CREATE INDEX "signup_attempts_requestIp_createdAt_idx" ON "signup_attempts"("requestIp", "createdAt");
