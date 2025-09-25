/*
  Warnings:

  - You are about to drop the column `ip` on the `app_stats_entry` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."app_stats_entry" DROP COLUMN "ip";
