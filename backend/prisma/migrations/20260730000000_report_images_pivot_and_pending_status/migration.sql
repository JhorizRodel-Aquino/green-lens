-- ReportStatus: UNRESOLVED -> REPORTED, add PENDING, change default to PENDING
CREATE TYPE "ReportStatus_new" AS ENUM ('PENDING', 'REPORTED', 'RESOLVED', 'FLAGGED');
ALTER TABLE "Report" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Report" ALTER COLUMN "status" TYPE "ReportStatus_new" USING (
  CASE "status"::text WHEN 'UNRESOLVED' THEN 'REPORTED' ELSE "status"::text END
)::"ReportStatus_new";
DROP TYPE "ReportStatus";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Pivot table for report images, replacing the imageUrls array column
CREATE TABLE "ReportImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportImage_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReportImage" ("id", "url", "reportId")
SELECT gen_random_uuid()::text, unnest("imageUrls"), "id" FROM "Report" WHERE array_length("imageUrls", 1) > 0;

ALTER TABLE "Report" DROP COLUMN "imageUrls";

ALTER TABLE "ReportImage" ADD CONSTRAINT "ReportImage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
