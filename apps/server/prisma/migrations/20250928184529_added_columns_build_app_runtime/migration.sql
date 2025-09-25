/*
  Warnings:

  - You are about to drop the column `appId` on the `build` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `build` table. All the data in the column will be lost.
  - You are about to drop the column `isRollback` on the `build` table. All the data in the column will be lost.
  - You are about to drop the column `platform` on the `build` table. All the data in the column will be lost.
  - You are about to drop the column `runtimeVersion` on the `build` table. All the data in the column will be lost.
  - Added the required column `appRuntimeId` to the `build` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."build" DROP CONSTRAINT "build_appId_fkey";

-- DropIndex
DROP INDEX "public"."build_appId_runtimeVersion_platform_key";

-- AlterTable
ALTER TABLE "public"."build" DROP COLUMN "appId",
DROP COLUMN "isActive",
DROP COLUMN "isRollback",
DROP COLUMN "platform",
DROP COLUMN "runtimeVersion",
ADD COLUMN     "appRuntimeId" TEXT NOT NULL,
ADD COLUMN     "message" TEXT;

-- CreateTable
CREATE TABLE "public"."app_runtime" (
    "_id" TEXT NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "platform" "public"."Platform" NOT NULL,
    "isRollback" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'production',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appId" TEXT NOT NULL,
    "activeBuildId" TEXT,

    CONSTRAINT "app_runtime_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_runtime_activeBuildId_key" ON "public"."app_runtime"("activeBuildId");

-- CreateIndex
CREATE UNIQUE INDEX "app_runtime_appId_runtimeVersion_platform_key" ON "public"."app_runtime"("appId", "runtimeVersion", "platform");

-- AddForeignKey
ALTER TABLE "public"."app_runtime" ADD CONSTRAINT "app_runtime_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."app"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."app_runtime" ADD CONSTRAINT "app_runtime_activeBuildId_fkey" FOREIGN KEY ("activeBuildId") REFERENCES "public"."build"("_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."build" ADD CONSTRAINT "build_appRuntimeId_fkey" FOREIGN KEY ("appRuntimeId") REFERENCES "public"."app_runtime"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
