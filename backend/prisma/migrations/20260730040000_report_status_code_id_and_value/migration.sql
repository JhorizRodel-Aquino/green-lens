-- ReportStatusCode gets its own generated id; "name" becomes "value" (the
-- underscored status string), and Report references the value, not an id.
ALTER TABLE "Report" DROP CONSTRAINT "Report_statusName_fkey";

ALTER TABLE "ReportStatusCode" RENAME COLUMN "name" TO "value";
ALTER TABLE "ReportStatusCode" DROP CONSTRAINT "ReportStatusCode_pkey";
ALTER TABLE "ReportStatusCode" ADD COLUMN "id" TEXT;
UPDATE "ReportStatusCode" SET "id" = gen_random_uuid()::text;
ALTER TABLE "ReportStatusCode" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "ReportStatusCode" ADD CONSTRAINT "ReportStatusCode_pkey" PRIMARY KEY ("id");
ALTER TABLE "ReportStatusCode" ADD CONSTRAINT "ReportStatusCode_value_key" UNIQUE ("value");

ALTER TABLE "Report" RENAME COLUMN "statusName" TO "statusValue";
ALTER TABLE "Report" ADD CONSTRAINT "Report_statusValue_fkey" FOREIGN KEY ("statusValue") REFERENCES "ReportStatusCode"("value") ON DELETE RESTRICT ON UPDATE CASCADE;
