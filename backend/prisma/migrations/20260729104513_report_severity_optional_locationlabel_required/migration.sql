/*
  Warnings:

  - Made the column `locationLabel` on table `Report` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "severity" DROP NOT NULL,
ALTER COLUMN "locationLabel" SET NOT NULL;
