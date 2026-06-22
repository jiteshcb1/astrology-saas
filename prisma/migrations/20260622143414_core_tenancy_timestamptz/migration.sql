/*
  Warnings:

  - Added the required column `updatedAt` to the `org_members` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "org_members" ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "verification_codes" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "verification_tokens" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMPTZ(6);
