-- Soft-delete leagues instead of hard deleting.

ALTER TABLE "League" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "League_deletedAt_idx" ON "League"("deletedAt");
