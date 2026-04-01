-- This migration assumes a fresh PostgreSQL database.
-- It creates all tables needed by WorldCuppy from scratch.

-- Auth tables (NextAuth / Prisma Adapter)

CREATE TABLE IF NOT EXISTS "User" (
    "id"            TEXT NOT NULL,
    "name"          TEXT,
    "email"         TEXT UNIQUE,
    "emailVerified" TIMESTAMP(3),
    "image"         TEXT,
    "passwordHash"  TEXT,
    "isAdmin"       BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

CREATE TABLE IF NOT EXISTS "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- App tables

CREATE TABLE IF NOT EXISTS "Tournament" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "year"           INTEGER NOT NULL,
    "teamsPerPlayer" INTEGER NOT NULL DEFAULT 4,
    "status"         TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TournamentDraft" (
    "tournamentId" TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "orderUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "currentPick"  INTEGER NOT NULL DEFAULT 0,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentDraft_pkey" PRIMARY KEY ("tournamentId"),
    CONSTRAINT "TournamentDraft_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TournamentDraft_status_idx" ON "TournamentDraft"("status");

CREATE TABLE IF NOT EXISTS "LineupPick" (
    "id"           TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "teamCode"     TEXT NOT NULL,
    "draftOdds"    INTEGER,
    "pickNumber"   INTEGER,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LineupPick_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LineupPick_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LineupPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LineupPick_tournamentId_userId_teamCode_key" ON "LineupPick"("tournamentId", "userId", "teamCode");
CREATE UNIQUE INDEX IF NOT EXISTS "LineupPick_tournamentId_pickNumber_key" ON "LineupPick"("tournamentId", "pickNumber");
CREATE INDEX IF NOT EXISTS "LineupPick_tournamentId_userId_idx" ON "LineupPick"("tournamentId", "userId");
CREATE INDEX IF NOT EXISTS "LineupPick_userId_idx" ON "LineupPick"("userId");
CREATE INDEX IF NOT EXISTS "LineupPick_tournamentId_idx" ON "LineupPick"("tournamentId");

CREATE TABLE IF NOT EXISTS "Match" (
    "id"            TEXT NOT NULL,
    "tournamentId"  TEXT NOT NULL,
    "stage"         TEXT NOT NULL,
    "groupName"     TEXT,
    "homeTeam"      TEXT NOT NULL,
    "awayTeam"      TEXT NOT NULL,
    "homeScore"     INTEGER,
    "awayScore"     INTEGER,
    "penaltyWinner" TEXT,
    "played"        BOOLEAN NOT NULL DEFAULT false,
    "matchDate"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Match_tournamentId_stage_idx" ON "Match"("tournamentId", "stage");

CREATE TABLE IF NOT EXISTS "EarningsAdjustment" (
    "id"           TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "reason"       TEXT NOT NULL,
    "amountCents"  INTEGER NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EarningsAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EarningsAdjustment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EarningsAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EarningsAdjustment_tournamentId_userId_idx" ON "EarningsAdjustment"("tournamentId", "userId");
