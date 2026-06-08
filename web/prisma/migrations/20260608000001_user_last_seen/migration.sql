-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

-- CreateIndex for efficient presence queries
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");
