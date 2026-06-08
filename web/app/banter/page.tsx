import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BanterFeed from "@/components/BanterFeed";

function colorIdx(userId: string, sortedIds: string[]): number {
  const i = sortedIds.indexOf(userId);
  if (i >= 0) return i % 8;
  // stable fallback: hash the userId
  let h = 0;
  for (let j = 0; j < userId.length; j++) h = (h * 31 + userId.charCodeAt(j)) | 0;
  return Math.abs(h) % 8;
}

export default async function BanterPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let currentUserId = session.user.id;
  if (!currentUserId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      currentUserId = u?.id;
    }
  }
  if (!currentUserId) redirect("/login");

  const [rawPosts, tournament] = await Promise.all([
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
  ]);

  // Build stable color map from all unique author IDs (sorted)
  const authorIds = [...new Set(rawPosts.map((p) => p.authorId))].sort();

  const posts = rawPosts.map((p) => ({
    id: p.id,
    authorId: p.authorId,
    authorName: p.author.name,
    colorIdx: colorIdx(p.authorId, authorIds),
    text: p.text,
    imageUrl: p.imageUrl,
    gifUrl: p.gifUrl,
    isSystem: p.isSystem,
    systemType: p.systemType,
    systemData: p.systemData as Record<string, string> | null,
    createdAt: p.createdAt.toISOString(),
    reactions: p.reactions,
    replyCount: p._count.replies,
    replies: p.replies.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorName: r.author.name,
      colorIdx: colorIdx(r.authorId, authorIds),
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      reactions: r.reactions,
    })),
  }));

  const draftInfo = tournament?.draftDate
    ? { name: tournament.name, year: tournament.year, date: tournament.draftDate.toISOString(), status: tournament.status }
    : null;

  return (
    <BanterFeed
      initialPosts={posts}
      currentUserId={currentUserId}
      currentUserName={session.user.name ?? session.user.email?.split("@")[0] ?? "?"}
      draftInfo={draftInfo}
    />
  );
}
