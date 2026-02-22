-- Track tournament points per team (global).

CREATE TABLE "TeamPoints" (
    "teamCode" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPoints_pkey" PRIMARY KEY ("teamCode")
);

CREATE INDEX "TeamPoints_points_idx" ON "TeamPoints"("points");
