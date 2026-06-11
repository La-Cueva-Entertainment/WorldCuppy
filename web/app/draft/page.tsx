import { redirect } from "next/navigation";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { CountryFlag } from "@/components/CountryFlag";
import { DraftPickTimer } from "@/components/DraftPickTimer";
import TieredTeamsBox from "@/components/TieredTeamsBox";
import { LiveRefresh } from "@/components/LiveRefresh";
import { requireUserId } from "@/lib/auth";
import { getSnakeTurnUserId } from "@/lib/draft";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const PICK_SECONDS = Number.parseInt(process.env.DRAFT_PICK_SECONDS ?? "60", 10) || 60;

// Static lookup — dynamic class names like `bg-${color}-500` get purged by Tailwind JIT
const MANAGER_COLORS = [
  { active: "bg-rose-100 ring-rose-300 text-rose-700 animate-pulse",    inactive: "bg-rose-50 ring-rose-200 text-rose-500" },
  { active: "bg-amber-100 ring-amber-300 text-amber-700 animate-pulse",  inactive: "bg-amber-50 ring-amber-200 text-amber-500" },
  { active: "bg-lime-100 ring-lime-300 text-lime-700 animate-pulse",    inactive: "bg-lime-50 ring-lime-200 text-lime-500" },
  { active: "bg-emerald-100 ring-emerald-300 text-emerald-700 animate-pulse", inactive: "bg-emerald-50 ring-emerald-200 text-emerald-500" },
  { active: "bg-cyan-100 ring-cyan-300 text-cyan-700 animate-pulse",    inactive: "bg-cyan-50 ring-cyan-200 text-cyan-500" },
  { active: "bg-sky-100 ring-sky-300 text-sky-700 animate-pulse",       inactive: "bg-sky-50 ring-sky-200 text-sky-500" },
  { active: "bg-indigo-100 ring-indigo-300 text-indigo-700 animate-pulse", inactive: "bg-indigo-50 ring-indigo-200 text-indigo-500" },
  { active: "bg-fuchsia-100 ring-fuchsia-300 text-fuchsia-700 animate-pulse", inactive: "bg-fuchsia-50 ring-fuchsia-200 text-fuchsia-500" },
] as const;

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

function shuffle<T>(items: T[]) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function DraftPage({
  searchParams,
}: {
  searchParams?: { error?: string; tier?: string } | Promise<{ error?: string; tier?: string }>;
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : {};
  const userId = await requireUserId();

  // Check if user is admin
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, name: true, email: true },
  });
  const isAdmin = me?.isAdmin ?? false;

  // Active tournament
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "upcoming"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <div className="text-5xl mb-4">🔜</div>
        <h1 className="text-2xl font-bold text-zinc-900">No draft open</h1>
        <p className="mt-2 text-zinc-500">No tournament is currently in draft mode.</p>
      </main>
    );
  }

  const LINEUP_SIZE = tournament.teamsPerPlayer;

  // Fetch draft + picks data
  const [draft, allPicks, allUsers] = await Promise.all([
    prisma.tournamentDraft.findUnique({
      where: { tournamentId: tournament.id },
      select: { status: true, currentPick: true, orderUserIds: true },
    }),
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { userId: true, teamCode: true, pickNumber: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const orderUserIds = (draft?.orderUserIds as string[] | null) ?? [];

  const takenTeamCodes = allPicks.map((p) => p.teamCode);
  const myPicks = allPicks.filter((p) => p.userId === userId);
  const myTeamCodes = myPicks.map((p) => p.teamCode);

  const maxPicks = Math.min(orderUserIds.length * LINEUP_SIZE, TEAMS.length);
  const currentPick = draft?.currentPick ?? 0;
  const draftActive = draft?.status === "active" && currentPick < maxPicks;

  const expectedTurnUserId = draftActive
    ? getSnakeTurnUserId(orderUserIds, currentPick)
    : null;
  const canPickNow = Boolean(expectedTurnUserId && expectedTurnUserId === userId);

  // Build owner map for TieredTeamsBox
  const takenBy: Record<string, { label: string; colorIndex: number }> = {};
  for (const p of allPicks) {
    const idx = orderUserIds.indexOf(p.userId);
    const u = userById.get(p.userId);
    takenBy[p.teamCode] = {
      label: u?.name ?? u?.email ?? "?",
      colorIndex: idx >= 0 ? idx : 0,
    };
  }

  // Tier the teams by rank
  const sorted = TEAMS.slice().sort((a, b) => a.rank - b.rank);
  const chunkSize = Math.ceil(sorted.length / 4);
  const tiers = [0, 1, 2, 3].map((ti) => {
    const chunk = sorted.slice(ti * chunkSize, (ti + 1) * chunkSize);
    const minRank = chunk[0]?.rank ?? 0;
    const maxRank = chunk[chunk.length - 1]?.rank ?? 0;
    return {
      key: `tier${ti + 1}`,
      labelBase: `Tier ${ti + 1}`,
      label: `Tier ${ti + 1}`,
      rangeLabel: `Rank ${minRank}–${maxRank}`,
      teams: chunk.map((t) => ({ code: t.code, name: t.name, rank: t.rank })),
    };
  });

  // ─── Server actions ──────────────────────────────────────────────

  async function draftTeamAction(formData: FormData) {
    "use server";

    const tier = String(formData.get("tier") ?? "").trim();
    const redirectBase = tier ? `/draft?tier=${encodeURIComponent(tier)}` : "/draft";

    const redirectDraft = (error?: string): never => {
      if (!error) redirect(redirectBase);
      redirect(`${redirectBase}${redirectBase.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
    };

    const uid = await requireUserId();

    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const teamCode = String(formData.get("teamCode") ?? "").trim();
    if (!tournamentId || !teamCode) redirectDraft();

    if (!TEAMS_BY_CODE.has(teamCode)) redirectDraft("Unknown team");

    try {
      await prisma.$transaction(async (tx) => {
        const draft = await tx.tournamentDraft.findUnique({
          where: { tournamentId },
          select: { status: true, currentPick: true, orderUserIds: true },
        });

        if (!draft || draft.status !== "active") throw new Error("NODRAFT");

        const orderIds = draft.orderUserIds as string[];
        const lineup = await tx.tournament.findUnique({
          where: { id: tournamentId },
          select: { teamsPerPlayer: true },
        });
        const lineupSize = lineup?.teamsPerPlayer ?? 4;
        const maxPicks = Math.min(orderIds.length * lineupSize, TEAMS.length);

        if (draft.currentPick >= maxPicks) throw new Error("DONE");

        const turnId = getSnakeTurnUserId(orderIds, draft.currentPick);
        if (!turnId || turnId !== uid) throw new Error("TURN");

        const myCount = await tx.lineupPick.count({ where: { tournamentId, userId: uid } });
        if (myCount >= lineupSize) throw new Error("FULL");

        const taken = await tx.lineupPick.findFirst({ where: { tournamentId, teamCode }, select: { id: true } });
        if (taken) throw new Error("TAKEN");

        const teamData = TEAMS_BY_CODE.get(teamCode);
        await tx.lineupPick.create({
          data: { tournamentId, userId: uid, teamCode, pickNumber: draft.currentPick, draftOdds: teamData?.rank ?? null },
          select: { id: true },
        });

        const updated = await tx.tournamentDraft.updateMany({
          where: { tournamentId, currentPick: draft.currentPick },
          data: { currentPick: { increment: 1 } },
        });
        if (updated.count !== 1) throw new Error("RACE");
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "TAKEN") redirectDraft("That team is already taken");
      if (msg === "FULL") redirectDraft("You already have the maximum teams");
      if (msg === "TURN") redirectDraft("Not your turn yet");
      if (msg === "NODRAFT") redirectDraft("Draft not active");
      if (msg === "DONE") redirectDraft("Draft is complete");
      redirectDraft("Could not draft team");
    }

    redirectDraft();
  }

  async function startDraftAction(formData: FormData) {
    "use server";

    const uid = await requireUserId();
    const adminUser = await prisma.user.findUnique({ where: { id: uid }, select: { isAdmin: true } });
    if (!adminUser?.isAdmin) redirect("/draft?error=Admins%20only");

    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    if (!tournamentId) redirect("/draft");

    // Only include users who have signed up (have an account with a name or email verified)
    const participants = await prisma.user.findMany({
      where: { email: { not: null } },
      select: { id: true },
    });
    const orderIds = shuffle(participants.map((u) => u.id));

    await prisma.tournamentDraft.upsert({
      where: { tournamentId },
      create: { tournamentId, status: "active", orderUserIds: orderIds, currentPick: 0 },
      update: { status: "active", orderUserIds: orderIds, currentPick: 0 },
    });

    await prisma.lineupPick.deleteMany({ where: { tournamentId } });
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "draft" } });

    redirect("/draft");
  }

  const roundNumber = draftActive && orderUserIds.length > 0
    ? Math.floor(currentPick / orderUserIds.length) + 1
    : null;

  const pickInRound = draftActive && orderUserIds.length > 0
    ? (currentPick % orderUserIds.length) + 1
    : null;

  const currentPickerName = expectedTurnUserId
    ? (() => {
        const u = userById.get(expectedTurnUserId);
        return u?.name ?? u?.email ?? "?";
      })()
    : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Refresh draft state every 15s so turn order stays current */}
      {draftActive && <LiveRefresh intervalMs={15_000} />}
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900">
            Draft — <span className="text-emerald-600">{tournament.name} {tournament.year}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {LINEUP_SIZE} teams per player · snake draft
          </p>
        </div>

        {isAdmin && !draftActive && (
          <form action={startDraftAction}>
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <ConfirmSubmitButton
              confirmText="Start the draft? This will reset any existing picks."
              className="inline-flex h-10 items-center rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Start Draft
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      {/* Error */}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {resolved.error}
        </div>
      )}

      {draftActive ? (
        <>
          {/* Draft status bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Now Picking</div>
              <div className="text-lg font-bold text-zinc-900">
                {canPickNow ? "Your turn! 🎉" : currentPickerName}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Round {roundNumber} · Pick {pickInRound} of {orderUserIds.length}
              </div>
            </div>
            {canPickNow && (
              <DraftPickTimer seconds={PICK_SECONDS} key={currentPick} />
            )}
          </div>

          {/* Draft order */}
          <div className="mb-6 flex flex-wrap gap-2">
            {orderUserIds.map((uid, idx) => {
              const u = userById.get(uid);
              const name = u?.name ?? `Player ${idx + 1}`;
              const isCurrent = draftActive && idx === (currentPick % orderUserIds.length)
                && Math.floor(currentPick / orderUserIds.length) % 2 === 0
                  ? idx === currentPick % orderUserIds.length
                  : idx === orderUserIds.length - 1 - (currentPick % orderUserIds.length);
              const colors = MANAGER_COLORS[idx % MANAGER_COLORS.length];
              return (
                <div
                  key={uid}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    isCurrent ? colors.active : colors.inactive
                  }`}
                >
                  {name} ({allPicks.filter((p) => p.userId === uid).length}/{LINEUP_SIZE})
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4">
          <p className="text-sm text-zinc-600">
            {draft?.status === "complete" || currentPick >= maxPicks
              ? "Draft is complete! Check the standings."
              : "Draft has not started yet. Waiting for admin to begin."}
          </p>
        </div>
      )}

      {/* Team picker */}
      <TieredTeamsBox
        tiers={tiers}
        initialTierKey={resolved.tier}
        takenTeamCodes={takenTeamCodes}
        myTeamCodes={myTeamCodes}
        takenBy={takenBy}
        canDraft={draftActive}
        canPickNow={canPickNow}
        picksCount={myPicks.length}
        lineupSize={LINEUP_SIZE}
        draftTeamAction={draftTeamAction}
        showDraftControls
        extraFormFields={
          <input type="hidden" name="tournamentId" value={tournament.id} />
        }
      />
    </main>
  );
}
