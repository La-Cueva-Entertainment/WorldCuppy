import "server-only";
import { prisma } from "@/lib/prisma";

export function getSnakeTurnUserId(orderUserIds: string[], pickNumber: number) {
  const n = orderUserIds.length;
  if (n <= 0) return null;
  const pickInRound = pickNumber % n;
  const roundIndex = Math.floor(pickNumber / n);
  const forward = roundIndex % 2 === 0;
  const idx = forward ? pickInRound : n - 1 - pickInRound;
  return orderUserIds[idx] ?? null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Creates the TournamentDraft with a randomized player order and flips the
 *  tournament to "draft" status. Safe to call concurrently — the second caller
 *  will silently no-op if another request beat it. */
export async function activateDraft(tournamentId: string): Promise<void> {
  // No-op if already activated
  const existing = await prisma.tournamentDraft.findUnique({
    where: { tournamentId },
    select: { tournamentId: true },
  });
  if (existing) return;

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { userId: true },
  });
  if (participants.length === 0) throw new Error("NO_PARTICIPANTS");

  const orderUserIds = shuffle(participants.map((p) => p.userId));

  try {
    await prisma.$transaction([
      prisma.tournamentDraft.create({
        data: { tournamentId, status: "active", orderUserIds, currentPick: 0 },
      }),
      prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: "draft" },
      }),
    ]);
  } catch (err: unknown) {
    // Unique constraint — another concurrent request already activated. Fine.
    if ((err as { code?: string })?.code === "P2002") return;
    throw err;
  }
}

/** Re-randomizes the draft order. Only allowed before any picks are made. */
export async function resetDraftOrder(tournamentId: string): Promise<void> {
  const draft = await prisma.tournamentDraft.findUnique({
    where: { tournamentId },
    select: { tournamentId: true },
  });
  if (!draft) throw new Error("NO_DRAFT");

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId },
    select: { userId: true },
  });
  const orderUserIds = shuffle(participants.map((p) => p.userId));

  // Atomic check-then-write so a concurrent pick cannot slip in between.
  await prisma.$transaction(async (tx) => {
    const pickCount = await tx.lineupPick.count({ where: { tournamentId } });
    if (pickCount > 0) throw new Error("PICKS_MADE");
    await tx.tournamentDraft.update({ where: { tournamentId }, data: { orderUserIds } });
  });
}
