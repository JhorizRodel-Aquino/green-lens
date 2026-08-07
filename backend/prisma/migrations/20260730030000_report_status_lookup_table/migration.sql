-- Replace the ReportStatus enum with a proper lookup table (name, validity),
-- so "which statuses are flagged" is a data join, not something hardcoded in app code.
CREATE TABLE "ReportStatusCode" (
    "name" TEXT NOT NULL,
    "validity" "ReportValidity" NOT NULL,
    CONSTRAINT "ReportStatusCode_pkey" PRIMARY KEY ("name")
);

INSERT INTO "ReportStatusCode" ("name", "validity") VALUES
    ('PENDING', 'VALID'),
    ('REPORTED', 'VALID'),
    ('RESOLVED', 'VALID'),
    ('FALSE_REPORT', 'FLAGGED'),
    ('DUPLICATE_REPORT', 'FLAGGED'),
    ('MINOR_LITTER', 'FLAGGED'),
    ('ALREADY_RESOLVED', 'FLAGGED'),
    ('PRIVATE_PROPERTY', 'FLAGGED');

ALTER TABLE "Report" ADD COLUMN "statusName" TEXT;
UPDATE "Report" SET "statusName" = "status"::text;
ALTER TABLE "Report" ALTER COLUMN "statusName" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "statusName" SET DEFAULT 'PENDING';

ALTER TABLE "Report" DROP COLUMN "status";
ALTER TABLE "Report" DROP COLUMN "validity";
DROP TYPE "ReportStatus";

ALTER TABLE "Report" ADD CONSTRAINT "Report_statusName_fkey" FOREIGN KEY ("statusName") REFERENCES "ReportStatusCode"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
