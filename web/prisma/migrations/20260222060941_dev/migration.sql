-- DropIndex
DROP INDEX "TeamPriceOverride_overridePrice_idx";

-- DropIndex
DROP INDEX "User_activeLeagueId_idx";

-- AlterTable
-- LeagueDraft is introduced in a later migration; make this safe for shadow DB.
DO $$
BEGIN
	IF to_regclass('public."LeagueDraft"') IS NOT NULL THEN
		EXECUTE 'ALTER TABLE "LeagueDraft" ALTER COLUMN "updatedAt" DROP DEFAULT';
	END IF;
END $$;

-- AlterTable
ALTER TABLE "TeamPoints" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeamPriceOverride" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeamStagePoints" ALTER COLUMN "updatedAt" DROP DEFAULT;
