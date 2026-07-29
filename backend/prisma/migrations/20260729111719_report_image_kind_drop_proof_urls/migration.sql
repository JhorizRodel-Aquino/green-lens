/*
  Warnings:

  - You are about to drop the column `resolutionProofUrls` on the `Report` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('USER_UPLOAD', 'RESOLUTION_PROOF');

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "resolutionProofUrls";

-- AlterTable
ALTER TABLE "ReportImage" ADD COLUMN     "kind" "ImageKind" NOT NULL DEFAULT 'USER_UPLOAD';
