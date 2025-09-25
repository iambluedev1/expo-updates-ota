/*
  Warnings:

  - A unique constraint covering the columns `[appId,runtimeVersion,platform,channel]` on the table `app_runtime` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authorId` to the `build` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."app_runtime_appId_runtimeVersion_platform_key";

-- AlterTable
ALTER TABLE "public"."build" ADD COLUMN     "authorId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "app_runtime_appId_runtimeVersion_platform_channel_key" ON "public"."app_runtime"("appId", "runtimeVersion", "platform", "channel");

-- AddForeignKey
ALTER TABLE "public"."build" ADD CONSTRAINT "build_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."user"("_id") ON DELETE CASCADE ON UPDATE CASCADE;
