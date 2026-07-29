-- ReportStatus: FLAGGED collapses into specific flag-reason values; drop separate FlagReason enum/column
CREATE TYPE "ReportStatus_new" AS ENUM ('PENDING', 'REPORTED', 'RESOLVED', 'FALSE_REPORT', 'DUPLICATE_REPORT', 'MINOR_LITTER', 'ALREADY_RESOLVED', 'PRIVATE_PROPERTY');
ALTER TABLE "Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "status" TYPE "ReportStatus_new" USING (
  CASE "status"::text WHEN 'FLAGGED' THEN 'FALSE_REPORT' ELSE "status"::text END
)::"ReportStatus_new";
DROP TYPE "ReportStatus";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TYPE "ReportValidity" AS ENUM ('VALID', 'FLAGGED');
ALTER TABLE "Report" ADD COLUMN "validity" "ReportValidity" NOT NULL DEFAULT 'VALID';
UPDATE "Report" SET "validity" = 'FLAGGED' WHERE "status" IN ('FALSE_REPORT', 'DUPLICATE_REPORT', 'MINOR_LITTER', 'ALREADY_RESOLVED', 'PRIVATE_PROPERTY');

ALTER TABLE "Report" DROP COLUMN "flagReason";
DROP TYPE "FlagReason";
