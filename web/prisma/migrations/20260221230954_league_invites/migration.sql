-- CreateTable
CREATE TABLE "LeagueInvite" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "LeagueInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueInvite_token_key" ON "LeagueInvite"("token");

-- CreateIndex
CREATE INDEX "LeagueInvite_email_idx" ON "LeagueInvite"("email");

-- CreateIndex
CREATE INDEX "LeagueInvite_leagueId_idx" ON "LeagueInvite"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueInvite_leagueId_email_key" ON "LeagueInvite"("leagueId", "email");

-- AddForeignKey
ALTER TABLE "LeagueInvite" ADD CONSTRAINT "LeagueInvite_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueInvite" ADD CONSTRAINT "LeagueInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
