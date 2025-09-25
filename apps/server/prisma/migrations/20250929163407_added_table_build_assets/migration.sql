/*
  Warnings:

  - You are about to drop the column `assetsPath` on the `build` table. All the data in the column will be lost.
  - You are about to drop the column `bundlePath` on the `build` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('BUNDLE', 'ASSET');

-- AlterTable
ALTER TABLE "public"."build" DROP COLUMN "assetsPath",
DROP COLUMN "bundlePath",
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."build_asset" (
    "_id" TEXT NOT NULL,
    "type" "public"."AssetType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT,
    "extension" TEXT,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "md5Key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buildId" TEXT NOT NULL,

    CONSTRAINT "build_asset_pkey" PRIMARY KEY ("_id")
);

-- AddForeignKey
ALTER TABLE "public"."build_asset" ADD CONSTRAINT "build_asset_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "public"."build"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
