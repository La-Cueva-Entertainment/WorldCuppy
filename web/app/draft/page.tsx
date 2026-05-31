import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountdownTimer } from "@/components/CountdownTimer";
import { CountryFlag } from "@/components/CountryFlag";
import { DraftPickTimer } from "@/components/DraftPickTimer";
import TieredTeamsBox from "@/components/TieredTeamsBox";
import { authOptions } from "@/lib/auth";
import { activateDraft, getSnakeTurnUserId } from "@/lib/draft";
import { buildDraftTiers } from "@/lib/draftTiers";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const PICK_SECONDS = Number.parseInt(process.env.DRAFT_PICK_SECONDS ?? "60", 10) || 60;

const MANAGER_COLORS = [
  "rose", "amber", "lime", "emerald", "cyan", "sky", "indigo", "fuchsia",
] as const;

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export default async function DraftPage({
  searchParams,
}: {
  searchParams?: { error?: string; tier?: string } | Promise<{ error?: string; tier?: string }>;
}) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : {};
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }
  if (!userId) redirect("/login");

  // Active tournament (draft or upcoming)
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "upcoming"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, draftDate: true },
  });

  if (!tournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <div className="text-5xl mb-4">🔜</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">No draft open</h1>
        <p className="mt-2 text-zinc-400">No tournament is currently in draft mode.</p>
      </main>
    );
  }

  // Auto-activate when draft date has arrived
  if (
    tournament.status === "upcoming" &&
    tournament.draftDate &&
    new Date() >= tournament.draftDate
  ) {
    try {
      await activateDraft(tournament.id);
    } catch {
      // No participants yet or already activated — fall through to render
    }
    redirect("/draft");
  }

  const LINEUP_SIZE = tournament.teamsPerPlayer;

  const [draft, allPicks, allUsers] = await Promise.all([
    prisma.tournamentDraft.findUnique({
      where: { tournamentId: tournament.id },
      select: { status: true, currentPick: true, orderUserIds: true },
    }),
    prisma.lineupPick.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { userId: true, teamCode: true, pickNumber: true, createdAt: true },
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

  const takenBy: Record<string, { label: string; colorIndex: number }> = {};
  for (const p of allPicks) {
    const idx = orderUserIds.indexOf(p.userId);
    const u = userById.get(p.userId);
    takenBy[p.teamCode] = {
      label: u?.name ?? u?.email ?? "?",
      colorIndex: idx >= 0 ? idx : 0,
    };
  }

  const tiers = buildDraftTiers(tournament.id);

  // ─── Server actions ──────────────────────────────────────────────

  async function draftTeamAction(formData: FormData) {
    "use server";

    const hdrs = await headers();
    const tier = String(formData.get("tier") ?? "").trim();
    const redirectBase = tier ? `/draft?tier=${encodeURIComponent(tier)}` : "/draft";

    const redirectDraft = (error?: string): never => {
      if (!error) redirect(redirectBase);
      redirect(`${redirectBase}${redirectBase.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`);
    };

    void hdrs;

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    let uid: string | undefined = session.user.id;
    if (!uid) {
      const email = session.user.email?.toLowerCase().trim();
      if (email) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        uid = u?.id;
      }
    }
    if (!uid) redirect("/login");

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

        await tx.lineupPick.create({
          data: { tournamentId, userId: uid, teamCode, pickNumber: draft.currentPick },
          select: { id: true },
        });

        const nextPick = draft.currentPick + 1;
        const isLastPick = nextPick >= maxPicks;

        await tx.tournamentDraft.updateMany({
          where: { tournamentId, currentPick: draft.currentPick },
          data: {
            currentPick: { increment: 1 },
            ...(isLastPick ? { status: "complete" } : {}),
          },
        });
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

  const draftComplete = draft?.status === "complete" || (maxPicks > 0 && currentPick >= maxPicks);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white">
            Draft — <span className="text-green-600 dark:text-green-400">{tournament.name} {tournament.year}</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {LINEUP_SIZE} teams per player · snake draft
          </p>
        </div>

        {!draftActive && !draftComplete && tournament.draftDate && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-5 py-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Draft scheduled</div>
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {tournament.draftDate.toLocaleString("en-US", {
                timeZone: "America/Los_Angeles",
                weekday: "long", month: "long", day: "numeric",
                hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
              })}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {resolved.error}
        </div>
      )}

      {draftActive ? (
        <>
          {/* Draft status bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-0.5">Now Picking</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white">
                {canPickNow ? "Your turn! 🎉" : currentPickerName}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Round {roundNumber} · Pick {pickInRound} of {orderUserIds.length}
              </div>
            </div>
            {canPickNow && (
              <DraftPickTimer seconds={PICK_SECONDS} key={currentPick} />
            )}
          </div>

          {/* Draft order — reversed on backward rounds so the active picker is always at the left */}
          <div className="mb-6 flex flex-wrap gap-2">
            {(() => {
              const round = Math.floor(currentPick / orderUserIds.length);
              const forward = round % 2 === 0;
              const displayIds = forward ? orderUserIds : [...orderUserIds].reverse();
              return displayIds.map((uid) => {
                const originalIdx = orderUserIds.indexOf(uid);
                const isCurrent = uid === expectedTurnUserId;
                const colorKey = MANAGER_COLORS[originalIdx % MANAGER_COLORS.length];
                const u = userById.get(uid);
                const name = u?.name ?? u?.email?.split("@")[0] ?? "?";
                return (
                  <div
                    key={uid}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                      isCurrent
                        ? `bg-${colorKey}-500/25 ring-${colorKey}-500/60 text-${colorKey}-700 dark:text-${colorKey}-200 animate-pulse`
                        : `bg-${colorKey}-500/10 ring-${colorKey}-500/20 text-${colorKey}-700 dark:text-${colorKey}-300`
                    }`}
                  >
                    {name} ({allPicks.filter((p) => p.userId === uid).length}/{LINEUP_SIZE})
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
        <div className="mb-6 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-5 py-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {draftComplete
              ? "Draft is complete! Check the standings."
              : orderUserIds.length === 0
                ? "No participants enrolled yet. An admin needs to set up the draft."
                : "Draft has not started yet. Waiting for the scheduled time."}
          </p>

          {/* Countdown to draft start */}
          {!draftComplete && tournament.draftDate && (
            <div className="mt-4">
              <CountdownTimer
                targetISO={tournament.draftDate.toISOString()}
                label={`${tournament.name} ${tournament.year} Draft`}
              />
            </div>
          )}

          {/* Show draft order if known (upcoming but draft record exists) */}
          {!draftComplete && orderUserIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {orderUserIds.map((uid, idx) => {
                const u = userById.get(uid);
                const name = u?.name ?? u?.email?.split("@")[0] ?? "?";
                const colorKey = MANAGER_COLORS[idx % MANAGER_COLORS.length];
                return (
                  <div
                    key={uid}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 bg-${colorKey}-500/10 ring-${colorKey}-500/20 text-${colorKey}-700 dark:text-${colorKey}-300`}
                  >
                    {idx + 1}. {name}
                  </div>
                );
              })}
            </div>
          )}
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
        showRanks={false}
        extraFormFields={
          <input type="hidden" name="tournamentId" value={tournament.id} />
        }
      />

      {/* Pick history — pick 1 first. Mobile: 2-col row-major. sm+: column-major (8/col). */}
      {allPicks.length > 0 && (() => {
        const pickCards = allPicks.map((p) => {
          const u = userById.get(p.userId);
          const playerName = u?.name ?? u?.email?.split("@")[0] ?? "?";
          const team = TEAMS_BY_CODE.get(p.teamCode);
          const idx = orderUserIds.indexOf(p.userId);
          const colorKey = MANAGER_COLORS[idx >= 0 ? idx % MANAGER_COLORS.length : 0];
          return (
            <div
              key={`${p.userId}-${p.teamCode}`}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-50 dark:bg-white/5 px-2 py-1"
            >
              <span className="w-5 shrink-0 text-right text-[9px] tabular-nums text-zinc-400 dark:text-zinc-600">#{(p.pickNumber ?? 0) + 1}</span>
              <CountryFlag code={p.teamCode} label={team?.name ?? p.teamCode} className="h-3 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900 dark:text-white">
                {team?.name ?? p.teamCode.toUpperCase()}
              </span>
              <span className={`shrink-0 text-[9px] font-semibold text-${colorKey}-600 dark:text-${colorKey}-400`}>
                {playerName}
              </span>
            </div>
          );
        });
        return (
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Pick History
            </h2>
            {/* Mobile: 2-col row-major */}
            <div className="grid grid-cols-2 gap-1 sm:hidden">{pickCards}</div>
            {/* Desktop: 4-col column-major, 8 rows deep */}
            <div className="hidden sm:grid sm:grid-flow-col gap-1" style={{ gridTemplateRows: "repeat(8, auto)" }}>{pickCards}</div>
          </section>
        );
      })()}
    </main>
  );
}
