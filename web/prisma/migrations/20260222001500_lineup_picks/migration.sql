-- Add draft lineup picks (league-scoped).

CREATE TABLE "LineupPick" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamCode" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineupPick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineupPick_leagueId_userId_teamCode_key" ON "LineupPick"("leagueId", "userId", "teamCode");
CREATE INDEX "LineupPick_leagueId_userId_idx" ON "LineupPick"("leagueId", "userId");
CREATE INDEX "LineupPick_userId_idx" ON "LineupPick"("userId");
CREATE INDEX "LineupPick_leagueId_idx" ON "LineupPick"("leagueId");

ALTER TABLE "LineupPick" ADD CONSTRAINT "LineupPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LineupPick" ADD CONSTRAINT "LineupPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
