-- Snake draft support: persist draft order/state and store pick numbers.

CREATE TABLE "LeagueDraft" (
    "leagueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderUserIds" TEXT[] NOT NULL,
    "currentPick" INTEGER NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueDraft_pkey" PRIMARY KEY ("leagueId"),
    CONSTRAINT "LeagueDraft_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LeagueDraft_status_idx" ON "LeagueDraft"("status");

ALTER TABLE "LineupPick" ADD COLUMN "pickNumber" INTEGER;

CREATE UNIQUE INDEX "LineupPick_leagueId_pickNumber_key" ON "LineupPick"("leagueId", "pickNumber");
