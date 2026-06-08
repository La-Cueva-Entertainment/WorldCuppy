import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

/**
 * POST /api/draft/skip
 *
 * Called by DraftPickTimer when a player's countdown reaches zero.
 * Advances currentPick by 1, effectively skipping the current picker's turn.
 * Any authenticated participant can trigger this — the optimistic lock on
 * `currentPick` ensures only one concurrent call wins.
 *
 * Only works when:
 *   - A tournament is in "draft" status
 *   - The draft status is "active"
 *   - A per-pick timer (pickSeconds) is configured on the tournament
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tournament = await prisma.tournament.findFirst({
    where: { status: "draft" },
    orderBy: { createdAt: "desc" },
    select: { id: true, teamsPerPlayer: true, pickSeconds: true },
  });

  if (!tournament) {
    return NextResponse.json({ skipped: false, reason: "no_active_draft" });
  }

  // Only skip if a timer is actually configured — unlimited drafts never auto-skip
  if (!tournament.pickSeconds) {
    return NextResponse.json({ skipped: false, reason: "no_timer" });
  }

  const draft = await prisma.tournamentDraft.findUnique({
    where: { tournamentId: tournament.id },
    select: { status: true, currentPick: true, orderUserIds: true },
  });

  if (!draft || draft.status !== "active") {
    return NextResponse.json({ skipped: false, reason: "draft_not_active" });
  }

  const orderIds = draft.orderUserIds as string[];
  const maxPicks = Math.min(orderIds.length * tournament.teamsPerPlayer, TEAMS.length);

  if (draft.currentPick >= maxPicks) {
    return NextResponse.json({ skipped: false, reason: "draft_complete" });
  }

  // Optimistic lock: only the first concurrent caller with this currentPick wins
  const result = await prisma.tournamentDraft.updateMany({
    where: { tournamentId: tournament.id, currentPick: draft.currentPick, status: "active" },
    data: { currentPick: { increment: 1 } },
  });

  return NextResponse.json({ skipped: result.count > 0 });
}
