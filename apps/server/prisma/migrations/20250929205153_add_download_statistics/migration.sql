-- AlterTable
ALTER TABLE "public"."app" ADD COLUMN     "saveDownloadStatistics" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."app_stats_entry" (
    "_id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "currentUpdateId" TEXT,
    "embeddedUpdateId" TEXT,
    "runtimeVersion" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appId" TEXT NOT NULL,
    "buildId" TEXT,

    CONSTRAINT "app_stats_entry_pkey" PRIMARY KEY ("_id")
);

-- CreateIndex
CREATE INDEX "app_stats_entry_appId_createdAt_idx" ON "public"."app_stats_entry"("appId", "createdAt");

-- CreateIndex
CREATE INDEX "app_stats_entry_buildId_createdAt_idx" ON "public"."app_stats_entry"("buildId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."app_stats_entry" ADD CONSTRAINT "app_stats_entry_appId_fkey" FOREIGN KEY ("appId") REFERENCES "public"."app"("_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."app_stats_entry" ADD CONSTRAINT "app_stats_entry_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "public"."build"("_id") ON DELETE SET NULL ON UPDATE CASCADE;
