-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HIGH', 'LOW');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "FlagReason" AS ENUM ('FALSE_REPORT', 'OUT_OF_CONTROL');

-- CreateEnum
CREATE TYPE "JurisdictionStatus" AS ENUM ('ASSIGNED', 'UNASSIGNED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "regionCode" DROP NOT NULL,
ALTER COLUMN "regionName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL,
    "details" TEXT NOT NULL,
    "locationLabel" TEXT,
    "imageUrls" TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "flagReason" "FlagReason",
    "flaggedAt" TIMESTAMP(3),
    "lguActionLogged" BOOLEAN NOT NULL DEFAULT false,
    "resolutionProofUrls" TEXT[],
    "regionCode" TEXT,
    "regionName" TEXT,
    "provinceCode" TEXT,
    "provinceName" TEXT,
    "municipalityCode" TEXT,
    "municipalityName" TEXT,
    "jurisdictionStatus" "JurisdictionStatus" NOT NULL DEFAULT 'UNASSIGNED',

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
