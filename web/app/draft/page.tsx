import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { CountdownTimer } from "@/components/CountdownTimer";
import { DraftOrderStrip } from "@/components/DraftOrderStrip";
import { DraftPickTimer } from "@/components/DraftPickTimer";
import DraftTeamTable from "@/components/DraftTeamTable";
import { authOptions } from "@/lib/auth";
import { postPickMade } from "@/lib/discord";
import { activateDraft, getSnakeTurnUserId } from "@/lib/draft";
import { buildDraftTiers } from "@/lib/draftTiers";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

import { isSiteOwner } from "@/lib/siteOwner";

const PICK_SECONDS_DEFAULT = Number.parseInt(process.env.DRAFT_PICK_SECONDS ?? "60", 10) || 60;

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

  // Check admin status
  const isAdmin = isSiteOwner(session) ||
    !!(await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }))?.isAdmin;

  // Active tournament (draft or upcoming)
  const tournament = await prisma.tournament.findFirst({
    where: { status: { in: ["draft", "upcoming"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, year: true, status: true, teamsPerPlayer: true, draftDate: true, pickSeconds: true },
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
  // null = unlimited (no countdown); fall back to env var default if not configured on tournament
  const PICK_SECONDS: number | null =
    tournament.pickSeconds === undefined
      ? PICK_SECONDS_DEFAULT
      : tournament.pickSeconds ?? null;

  const [draft, allPicks, allUsers, participants] = await Promise.all([
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
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      select: { userId: true, teamName: true },
    }),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const teamNameById = new Map(participants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!]));
  function displayName(uid: string, fallbackEmail = true): string {
    const raw = teamNameById.has(uid) ? teamNameById.get(uid)! : null;
    if (raw) return raw.length > 22 ? raw.slice(0, 22).trimEnd() + "…" : raw;
    const u = userById.get(uid);
    return fallbackEmail ? (u?.name ?? u?.email?.split("@")[0] ?? "?") : (u?.name ?? "?");
  }
  // Returns "First L." when the user has a team name set, else null
  function shortRealName(uid: string): string | null {
    if (!teamNameById.has(uid)) return null; // no team name — real name is already showing
    const u = userById.get(uid);
    const full = u?.name ?? u?.email?.split("@")[0];
    if (!full) return null;
    const parts = full.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  }
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
    takenBy[p.teamCode] = {
      label: displayName(p.userId),
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

    let _orderIds: string[] = [];
    let _pickAt = -1;
    let _maxPicks = 0;

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
        _orderIds = orderIds;
        _pickAt = draft.currentPick;
        _maxPicks = maxPicks;

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

    // Discord notification — never block or fail the draft flow
    try {
      const team = TEAMS_BY_CODE.get(teamCode);
      const picker = userById.get(uid!);
      if (team && picker && _pickAt >= 0) {
        const nextPick = _pickAt + 1;
        const isDraftComplete = nextPick >= _maxPicks;
        const nextPickerId = !isDraftComplete ? getSnakeTurnUserId(_orderIds, nextPick) : null;
        const nextPickerUser = nextPickerId ? userById.get(nextPickerId) : null;
        const siteBase =
          process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
          (() => {
            const host = hdrs.get("host") ?? "localhost:3000";
            const proto = hdrs.get("x-forwarded-proto") ?? "http";
            return `${proto}://${host}`;
          })();
        await postPickMade({
          pickerName: teamNameById.get(uid!) ?? picker.name ?? picker.email ?? "?",
          teamName: team.name,
          teamCode,
          pickNumber: _pickAt + 1,
          totalPicks: _maxPicks,
          nextPickerName: nextPickerUser ? (teamNameById.get(nextPickerId!) ?? nextPickerUser.name ?? nextPickerUser.email ?? "?") : null,
          tournamentName: tournament ? `${tournament.name} ${tournament.year}` : "Draft",
          draftUrl: `${siteBase}/draft`,
          isDraftComplete,
        });
      }
    } catch { /* ignore Discord failures */ }

    redirectDraft();
  }

  // ─── Admin override: pick on behalf of another player ─────────────────────

  async function adminPickAction(formData: FormData) {
    "use server";

    const hdrs = await headers();

    const sess = await getServerSession(authOptions);
    if (!sess) redirect("/login");

    // Verify admin
    let adminId: string | undefined = sess.user.id;
    if (!adminId) {
      const email = sess.user.email?.toLowerCase().trim();
      if (email) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        adminId = u?.id;
      }
    }
    if (!adminId) redirect("/login");

    const isAdminUser = isSiteOwner(sess) ||
      !!(await prisma.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } }))?.isAdmin;
    if (!isAdminUser) redirect("/draft?error=Not+authorized");

    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const teamCode = String(formData.get("teamCode") ?? "").trim();
    const onBehalfOf = String(formData.get("onBehalfOfUserId") ?? "").trim();

    if (!tournamentId || !teamCode || !onBehalfOf) redirect("/draft?error=Missing+fields");
    if (!TEAMS_BY_CODE.has(teamCode)) redirect("/draft?error=Unknown+team");

    let _orderIds: string[] = [];
    let _pickAt = -1;
    let _maxPicks = 0;

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
        _orderIds = orderIds;
        _pickAt = draft.currentPick;
        _maxPicks = maxPicks;

        if (draft.currentPick >= maxPicks) throw new Error("DONE");

        // Verify it is actually onBehalfOf's turn
        const turnId = getSnakeTurnUserId(orderIds, draft.currentPick);
        if (!turnId || turnId !== onBehalfOf) throw new Error("TURN");

        const myCount = await tx.lineupPick.count({ where: { tournamentId, userId: onBehalfOf } });
        if (myCount >= lineupSize) throw new Error("FULL");

        const taken = await tx.lineupPick.findFirst({ where: { tournamentId, teamCode }, select: { id: true } });
        if (taken) throw new Error("TAKEN");

        await tx.lineupPick.create({
          data: { tournamentId, userId: onBehalfOf, teamCode, pickNumber: draft.currentPick },
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
      if (msg === "TAKEN") redirect("/draft?error=That+team+is+already+taken");
      if (msg === "FULL") redirect("/draft?error=Player+already+has+the+maximum+teams");
      if (msg === "TURN") redirect("/draft?error=Not+that+player%27s+turn");
      if (msg === "NODRAFT") redirect("/draft?error=Draft+not+active");
      if (msg === "DONE") redirect("/draft?error=Draft+is+complete");
      redirect("/draft?error=Could+not+draft+team");
    }

    // Discord notification
    try {
      const team = TEAMS_BY_CODE.get(teamCode);
      const allUsers2 = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
      const userById2 = new Map(allUsers2.map((u) => [u.id, u]));
      const participants2 = await prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        select: { userId: true, teamName: true },
      });
      const teamNameById2 = new Map(participants2.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!]));
      const picker = userById2.get(onBehalfOf);
      if (team && picker && _pickAt >= 0) {
        const nextPick = _pickAt + 1;
        const isDraftComplete = nextPick >= _maxPicks;
        const nextPickerId = !isDraftComplete ? getSnakeTurnUserId(_orderIds, nextPick) : null;
        const nextPickerUser = nextPickerId ? userById2.get(nextPickerId) : null;
        const siteBase =
          process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
          (() => {
            const host = hdrs.get("host") ?? "localhost:3000";
            const proto = hdrs.get("x-forwarded-proto") ?? "http";
            return `${proto}://${host}`;
          })();
        await postPickMade({
          pickerName: teamNameById2.get(onBehalfOf) ?? picker.name ?? picker.email ?? "?",
          teamName: team.name,
          teamCode,
          pickNumber: _pickAt + 1,
          totalPicks: _maxPicks,
          nextPickerName: nextPickerUser ? (teamNameById2.get(nextPickerId!) ?? nextPickerUser.name ?? nextPickerUser.email ?? "?") : null,
          tournamentName: tournament ? `${tournament.name} ${tournament.year}` : "Draft",
          draftUrl: `${siteBase}/draft`,
          isDraftComplete,
        });
      }
    } catch { /* ignore Discord failures */ }

    redirect("/draft");
  }

  const roundNumber = draftActive && orderUserIds.length > 0
    ? Math.floor(currentPick / orderUserIds.length) + 1
    : null;

  const pickInRound = draftActive && orderUserIds.length > 0
    ? (currentPick % orderUserIds.length) + 1
    : null;

  const currentPickerName = expectedTurnUserId ? displayName(expectedTurnUserId) : null;

  const draftComplete = draft?.status === "complete" || (maxPicks > 0 && currentPick >= maxPicks);

  const recentPicks = allPicks.map((p) => {
    const team = TEAMS_BY_CODE.get(p.teamCode);
    const colorIdx = orderUserIds.indexOf(p.userId);
    return {
      pickNumber: (p.pickNumber ?? 0) + 1,
      teamCode: p.teamCode,
      teamName: team?.name ?? p.teamCode.toUpperCase(),
      pickerName: displayName(p.userId),
      colorIdx: colorIdx >= 0 ? colorIdx : 0,
    };
  });

  return (
    <main className="page">
      <div className="wrap">

      {/* ── Page header ─────────────────────────────── */}
      <div className="between" style={{ flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
        <div>
          <div className={`kicker ${draftActive ? "grass" : ""}`}>
            {draftActive ? "Snake draft · Live" : draftComplete ? "Snake draft · Complete" : "Snake draft · Scheduled"}
          </div>
          <h1 style={{ marginTop: 4 }}>Draft Console</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {tournament.name} {tournament.year} · {LINEUP_SIZE} teams per player ·{" "}
            {currentPick} of {maxPicks} picked
          </p>
        </div>
      </div>

      {/* Error */}
      {resolved.error && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 14, borderColor: "var(--hot)", color: "var(--hot)" }}>
          {resolved.error}
        </div>
      )}

      {draftActive ? (
        <>
          {/* ── Clockbar ──────────────────────────────── */}
          <div className="clockbar pitch-panel">
            <div className="who">
              <div className="lbl">● On the clock</div>
              <div className="nm">
                {canPickNow ? `Your pick, ${displayName(userId)}` : currentPickerName}
              </div>
              <div className="sub">
                Round {roundNumber} · Pick {pickInRound} of {orderUserIds.length} · pick a team below
              </div>
            </div>
            <DraftPickTimer seconds={PICK_SECONDS} key={currentPick} />
          </div>

          {/* ── Draft grid: aside (order) | board ─── */}
          <div className="draft-grid">
            <aside className="card rail-panel">
              <div className="rail-h">Draft order</div>
              <DraftOrderStrip
                participants={orderUserIds.map((uid, idx) => ({
                  userId: uid,
                  name: displayName(uid),
                  real: shortRealName(uid),
                  colorIndex: idx,
                }))}
                activeUserId={expectedTurnUserId}
                currentUserId={userId}
              />
            </aside>

            {/* Right: team picker board */}
            <div>
              <DraftTeamTable
                tiers={tiers}
                takenTeamCodes={takenTeamCodes}
                myTeamCodes={myTeamCodes}
                takenBy={takenBy}
                canDraft={true}
                canPickNow={canPickNow}
                picksCount={myPicks.length}
                lineupSize={LINEUP_SIZE}
                draftTeamAction={draftTeamAction}
                extraFormFields={<input type="hidden" name="tournamentId" value={tournament.id} />}
                initialTierKey={resolved.tier}
                recentPicks={recentPicks}
              />
            </div>
          </div>

          {/* ── Admin: pick on behalf of ─────────────── */}
          {isAdmin && expectedTurnUserId && (
            <details className="card" style={{ marginTop: 18, padding: "14px 18px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, userSelect: "none", color: "var(--ink-soft)" }}>
                🔧 Admin override — pick on behalf of {displayName(expectedTurnUserId)}
              </summary>
              <form action={adminPickAction} style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="onBehalfOfUserId" value={expectedTurnUserId} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-faint)" }}>Team code</label>
                  <input
                    type="text"
                    name="teamCode"
                    placeholder="e.g. esp"
                    required
                    list="admin-teams-list"
                    style={{
                      padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line)",
                      background: "var(--surface)", color: "var(--ink)", fontSize: 14, width: 180,
                    }}
                  />
                  <datalist id="admin-teams-list">
                    {TEAMS.filter((t) => !takenTeamCodes.includes(t.code)).map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </datalist>
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: 36 }}>
                  Draft for {displayName(expectedTurnUserId)}
                </button>
              </form>
            </details>
          )}
        </>
      ) : (
        <>
          {/* Status / countdown card */}
          <div className="card" style={{ padding: "20px 24px", marginBottom: 18 }}>
            <p style={{ color: "var(--ink-soft)" }}>
              {draftComplete
                ? "Draft is complete! Check the standings."
                : orderUserIds.length === 0
                  ? "No participants enrolled yet. An admin needs to set up the draft."
                  : "Draft has not started yet. Waiting for the scheduled time."}
            </p>
            {!draftComplete && tournament.draftDate && (
              <div style={{ marginTop: 16 }}>
                <CountdownTimer
                  targetISO={tournament.draftDate.toISOString()}
                  label={`${tournament.name} ${tournament.year} Draft`}
                />
              </div>
            )}
          </div>

          {/* Draft order strip + team table */}
          {!draftComplete && (
            <div className="draft-grid">
              {orderUserIds.length > 0 && (
                <aside className="card rail-panel">
                  <div className="rail-h">Draft order</div>
                  <DraftOrderStrip
                    participants={orderUserIds.map((uid, idx) => ({
                      userId: uid,
                      name: displayName(uid),
                      real: shortRealName(uid),
                      colorIndex: idx,
                    }))}
                    activeUserId={null}
                    currentUserId={userId}
                  />
                </aside>
              )}
              <DraftTeamTable
                tiers={tiers}
                takenTeamCodes={takenTeamCodes}
                myTeamCodes={myTeamCodes}
                takenBy={takenBy}
                canDraft={false}
                canPickNow={false}
                showAvailable={true}
                picksCount={myPicks.length}
                lineupSize={LINEUP_SIZE}
                draftTeamAction={draftTeamAction}
                initialTierKey={resolved.tier}
                recentPicks={recentPicks}
              />
            </div>
          )}
        </>
      )}

      </div>
    </main>
  );
}

