-- Add league buy-in and stage-based team points.

ALTER TABLE "League" ADD COLUMN "buyInCents" INTEGER NOT NULL DEFAULT 4000;

CREATE TABLE "TeamStagePoints" (
    "teamCode" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamStagePoints_pkey" PRIMARY KEY ("teamCode", "stageKey")
);

CREATE INDEX "TeamStagePoints_stageKey_idx" ON "TeamStagePoints"("stageKey");
