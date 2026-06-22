/*
  Warnings:

  - You are about to drop the column `code` on the `verification_codes` table. All the data in the column will be lost.
  - Added the required column `codeHash` to the `verification_codes` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "verification_codes_email_idx";

-- AlterTable
ALTER TABLE "verification_codes" DROP COLUMN "code",
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codeHash" TEXT NOT NULL,
ADD COLUMN     "requestIp" TEXT;

-- CreateIndex
CREATE INDEX "verification_codes_email_createdAt_idx" ON "verification_codes"("email", "createdAt");
