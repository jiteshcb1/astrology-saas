/*
  Warnings:

  - The `role` column on the `org_members` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'consultant', 'team_consulting', 'team_accounts', 'seeker');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('consultant', 'team_consulting', 'team_accounts');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'invited', 'removed');

-- DropIndex
DROP INDEX "org_members_organizationId_idx";

-- AlterTable
ALTER TABLE "org_members" ADD COLUMN     "isBillableSeat" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "role",
ADD COLUMN     "role" "MemberRole" NOT NULL DEFAULT 'consultant';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "status" "OrgStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authProvider" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'seeker';

-- DropEnum
DROP TYPE "Role";

-- CreateIndex
CREATE INDEX "org_members_organizationId_role_status_idx" ON "org_members"("organizationId", "role", "status");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
