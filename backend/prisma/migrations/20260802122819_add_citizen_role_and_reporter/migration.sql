-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CITIZEN';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "reporterId" TEXT;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
