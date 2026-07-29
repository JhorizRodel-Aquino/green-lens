-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('RESOLUTION', 'REOPEN');

-- CreateTable
CREATE TABLE "ReportNote" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" "NoteKind" NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReportNote" ADD CONSTRAINT "ReportNote_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
