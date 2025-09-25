/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `organization` table. All the data in the column will be lost.
  - You are about to drop the `organization_invitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organization_member` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."organization_invitation" DROP CONSTRAINT "organization_invitation_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."organization_invitation" DROP CONSTRAINT "organization_invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."organization_member" DROP CONSTRAINT "organization_member_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."organization_member" DROP CONSTRAINT "organization_member_userId_fkey";

-- DropIndex
DROP INDEX "public"."organization_slug_key";

-- AlterTable
ALTER TABLE "organization" DROP COLUMN "updatedAt",
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "metadata" TEXT,
ALTER COLUMN "slug" DROP NOT NULL,
ALTER COLUMN "createdAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "activeOrganizationId" TEXT,
ADD COLUMN     "activeTeamId" TEXT;

-- DropTable
DROP TABLE "public"."organization_invitation";

-- DropTable
DROP TABLE "public"."organization_member";

-- DropEnum
DROP TYPE "public"."InvitationStatus";

-- DropEnum
DROP TYPE "public"."OrganizationRole";

-- CreateTable
CREATE TABLE "member" (
    "_id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("_id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviterId" TEXT,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("_id")
);

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
