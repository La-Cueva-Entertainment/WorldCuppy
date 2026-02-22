-- Add active league selection for users
ALTER TABLE "User" ADD COLUMN     "activeLeagueId" TEXT;

-- Remove old join codes (email invites replace this)
ALTER TABLE "League" DROP COLUMN "joinCode";

-- Foreign key for active league
ALTER TABLE "User" ADD CONSTRAINT "User_activeLeagueId_fkey" FOREIGN KEY ("activeLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for filtering
CREATE INDEX "User_activeLeagueId_idx" ON "User"("activeLeagueId");
