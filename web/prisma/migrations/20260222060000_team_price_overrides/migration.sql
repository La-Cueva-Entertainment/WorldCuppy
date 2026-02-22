-- Manual team price overrides (site owner admin).

CREATE TABLE "TeamPriceOverride" (
    "teamCode" TEXT NOT NULL,
    "overridePrice" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPriceOverride_pkey" PRIMARY KEY ("teamCode")
);

CREATE INDEX "TeamPriceOverride_overridePrice_idx" ON "TeamPriceOverride"("overridePrice");
