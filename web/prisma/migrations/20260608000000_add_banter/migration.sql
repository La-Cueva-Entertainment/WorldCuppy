-- CreateTable
CREATE TABLE "BanterPost" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "gifUrl" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemType" TEXT,
    "systemData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanterPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanterReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "BanterReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanterReply" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanterReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanterReplyReaction" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "BanterReplyReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BanterPost_tournamentId_idx" ON "BanterPost"("tournamentId");

-- CreateIndex
CREATE INDEX "BanterPost_createdAt_idx" ON "BanterPost"("createdAt");

-- CreateIndex
CREATE INDEX "BanterReaction_postId_idx" ON "BanterReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "BanterReaction_postId_userId_emoji_key" ON "BanterReaction"("postId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "BanterReply_postId_idx" ON "BanterReply"("postId");

-- CreateIndex
CREATE INDEX "BanterReplyReaction_replyId_idx" ON "BanterReplyReaction"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "BanterReplyReaction_replyId_userId_emoji_key" ON "BanterReplyReaction"("replyId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "BanterPost" ADD CONSTRAINT "BanterPost_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterPost" ADD CONSTRAINT "BanterPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReaction" ADD CONSTRAINT "BanterReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BanterPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReaction" ADD CONSTRAINT "BanterReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReply" ADD CONSTRAINT "BanterReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BanterPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReply" ADD CONSTRAINT "BanterReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReplyReaction" ADD CONSTRAINT "BanterReplyReaction_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "BanterReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanterReplyReaction" ADD CONSTRAINT "BanterReplyReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
