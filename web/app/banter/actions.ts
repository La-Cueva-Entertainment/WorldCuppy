"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToAll } from "@/lib/push";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Not authenticated");

  let userId = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user?.id) userId = user.id;
    }
  }
  if (!userId) throw new Error("User not found");
  return userId;
}

async function findActiveTournamentId(): Promise<string | undefined> {
  const t = await prisma.tournament.findFirst({
    where: { status: { in: ["upcoming", "draft", "active", "complete"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return t?.id;
}

export async function createPost(text: string, imageUrl?: string, gifUrl?: string) {
  const userId = await requireUser();
  if (!text.trim()) throw new Error("Post text is required");

  const tournamentId = await findActiveTournamentId();

  await prisma.banterPost.create({
    data: {
      text: text.trim(),
      imageUrl: imageUrl ?? null,
      gifUrl: gifUrl ?? null,
      authorId: userId,
      tournamentId: tournamentId ?? null,
    },
  });

  // Push notification to everyone else — fire-and-forget
  const author = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const displayName = author?.name ?? "Someone";
  sendPushToAll(
    {
      title: `${displayName} posted in Banter`,
      body: text.trim().slice(0, 100),
      url: "/banter",
      tag: "banter-post",
    },
    userId
  ).catch(() => {});

  revalidatePath("/banter");
}

export async function toggleReaction(postId: string, emoji: string) {
  const userId = await requireUser();

  const existing = await prisma.banterReaction.findUnique({
    where: { postId_userId_emoji: { postId, userId, emoji } },
  });

  if (existing) {
    await prisma.banterReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.banterReaction.create({ data: { postId, userId, emoji } });
  }

  revalidatePath("/banter");
}

export async function createReply(postId: string, text: string) {
  const userId = await requireUser();
  if (!text.trim()) throw new Error("Reply text is required");

  await prisma.banterReply.create({
    data: { postId, text: text.trim(), authorId: userId },
  });

  revalidatePath("/banter");
}

export async function toggleReplyReaction(replyId: string, emoji: string) {
  const userId = await requireUser();

  const existing = await prisma.banterReplyReaction.findUnique({
    where: { replyId_userId_emoji: { replyId, userId, emoji } },
  });

  if (existing) {
    await prisma.banterReplyReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.banterReplyReaction.create({ data: { replyId, userId, emoji } });
  }

  revalidatePath("/banter");
}

export async function getReplies(postId: string) {
  await requireUser();

  const replies = await prisma.banterReply.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true } },
      reactions: { select: { id: true, emoji: true, userId: true } },
    },
  });

  // Build stable color index from sorted author IDs in this reply set
  const authorIds = [...new Set(replies.map((r) => r.authorId))].sort();
  function colorIdx(userId: string) {
    const i = authorIds.indexOf(userId);
    if (i >= 0) return i % 8;
    let h = 0;
    for (let j = 0; j < userId.length; j++) h = (h * 31 + userId.charCodeAt(j)) | 0;
    return Math.abs(h) % 8;
  }

  return replies.map((r) => ({
    id: r.id,
    postId: r.postId,
    authorId: r.authorId,
    authorName: r.author.name,
    colorIdx: colorIdx(r.authorId),
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    reactions: r.reactions,
  }));
}

/** Called from the draft flow when a pick is made. */
export async function createPickSystemPost(
  mgrId: string,
  teamCode: string,
  tournamentId: string,
) {
  await prisma.banterPost.create({
    data: {
      isSystem: true,
      systemType: "pick",
      systemData: { mgrId, teamCode },
      text: "",
      authorId: mgrId,
      tournamentId,
    },
  });
  revalidatePath("/banter");
}

/** Called when a match result is recorded. */
export async function createResultSystemPost(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  earnerId: string,
  earnerCents: number,
  tournamentId: string,
) {
  await prisma.banterPost.create({
    data: {
      isSystem: true,
      systemType: "result",
      systemData: { homeTeam, awayTeam, homeScore: String(homeScore), awayScore: String(awayScore), earnerCents: String(earnerCents) },
      text: "",
      authorId: earnerId,
      tournamentId,
    },
  });
  revalidatePath("/banter");
}
