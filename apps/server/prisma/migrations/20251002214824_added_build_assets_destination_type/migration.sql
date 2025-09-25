-- CreateEnum
CREATE TYPE "BuildAssetDestination" AS ENUM ('LOCAL', 'S3');

-- AlterTable
ALTER TABLE "build_asset" ADD COLUMN     "destination" "BuildAssetDestination" NOT NULL DEFAULT 'LOCAL';
