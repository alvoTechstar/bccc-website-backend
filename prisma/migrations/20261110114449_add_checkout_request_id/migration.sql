-- AlterTable
ALTER TABLE "giving_records" ADD COLUMN "checkoutRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "giving_records_checkoutRequestId_key" ON "giving_records"("checkoutRequestId");
