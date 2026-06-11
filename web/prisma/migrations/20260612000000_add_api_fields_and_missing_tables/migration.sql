-- Add missing columns to Tournament table
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "apiCode"    TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "apiSeason"  INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "poolName"   TEXT;

-- Ensure inviteToken has a unique index (safe if already present)
CREATE UNIQUE INDEX IF NOT EXISTS "Tournament_inviteToken_key" ON "Tournament"("inviteToken");

-- Add missing index on Match(tournamentId, matchDate)
CREATE INDEX IF NOT EXISTS "Match_tournamentId_matchDate_idx" ON "Match"("tournamentId", "matchDate");

-- PasswordResetToken table
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- TeamOdds table
CREATE TABLE IF NOT EXISTS "TeamOdds" (
    "id"           TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamCode"     TEXT NOT NULL,
    "currentOdds"  INTEGER NOT NULL,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamOdds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeamOdds_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamOdds_tournamentId_teamCode_key" ON "TeamOdds"("tournamentId", "teamCode");
CREATE INDEX IF NOT EXISTS "TeamOdds_tournamentId_idx" ON "TeamOdds"("tournamentId");

-- ScoringConfig table
CREATE TABLE IF NOT EXISTS "ScoringConfig" (
    "tournamentId" TEXT NOT NULL,
    "config"       JSONB NOT NULL,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScoringConfig_pkey" PRIMARY KEY ("tournamentId"),
    CONSTRAINT "ScoringConfig_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AdminAuditLog table
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id"        TEXT NOT NULL,
    "adminId"   TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "target"    TEXT NOT NULL,
    "changes"   JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");
