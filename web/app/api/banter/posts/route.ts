import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function colorIdx(userId: string, sortedIds: string[]): number {
  const i = sortedIds.indexOf(userId);
  if (i >= 0) return i % 8;
  let h = 0;
  for (let j = 0; j < userId.length; j++) h = (h * 31 + userId.charCodeAt(j)) | 0;
  return Math.abs(h) % 8;
}

async function resolveUserId(session: Session | null): Promise<string | null> {
  if (!session) return null;
  if (session.user.id) return session.user.id;
  const email = session.user.email?.toLowerCase().trim();
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return u?.id ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const currentUserId = await resolveUserId(session);
  if (!currentUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const [rawPosts, tournament, onlineUsers] = await Promise.all([
    prisma.banterPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        author: { select: { id: true, name: true } },
        reactions: { select: { id: true, emoji: true, userId: true } },
        replies: {
          take: 3,
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true } },
            reactions: { select: { id: true, emoji: true, userId: true } },
          },
        },
        _count: { select: { replies: true } },
      },
    }),
    prisma.tournament.findFirst({
      where: { status: { in: ["upcoming", "draft", "active", "complete"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, year: true, draftDate: true, status: true },
    }),
    prisma.user.findMany({
      where: { lastSeenAt: { gte: onlineThreshold } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, name: true, lastSeenAt: true },
    }),
  ]);

  const allUserIds = [...new Set([
    ...rawPosts.map((p) => p.authorId),
    ...rawPosts.flatMap((p) => p.replies.map((r) => r.authorId)),
    ...onlineUsers.map((u) => u.id),
    currentUserId,
  ])];

  let teamNameById = new Map<string, string>();
  if (tournament) {
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id, userId: { in: allUserIds } },
      select: { userId: true, teamName: true },
    });
    teamNameById = new Map(
      participants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!])
    );
  }

  function dn(userId: string, fallback: string | null | undefined): string {
    return teamNameById.get(userId) ?? fallback ?? "?";
  }

  const authorIds = [...new Set(rawPosts.map((p) => p.authorId))].sort();

  const posts = rawPosts.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    authorName: dn(p.authorId, p.author.name),
    colorIdx: colorIdx(p.authorId, authorIds),
    text: p.text,
    imageUrl: p.imageUrl,
    gifUrl: p.gifUrl,
    isSystem: p.isSystem,
    systemType: p.systemType,
    systemData: p.systemData,
    createdAt: p.createdAt.toISOString(),
    reactions: p.reactions,
    replyCount: p._count.replies,
    replies: p.replies.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorName: dn(r.authorId, r.author.name),
      colorIdx: colorIdx(r.authorId, authorIds),
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      reactions: r.reactions,
    })),
  }));

  return NextResponse.json(
    { posts },
    { headers: { "Cache-Control": "no-store" } }
  );
}
