import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { CopyButton } from "@/components/CopyButton";
import DraftOrderPicker from "@/components/DraftOrderPicker";
import { authOptions } from "@/lib/auth";
import { postDraftStarted } from "@/lib/discord";
import { activateDraft, resetDraftOrder } from "@/lib/draft";
import { DEFAULT_PAYOUT_RULES, resolvePayoutRules, type PayoutRules } from "@/lib/earnings";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";
import { TEAMS } from "@/lib/teams";
import { headers } from "next/headers";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const siteOwner = isSiteOwner(session);

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id;
    }
  }
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin && !siteOwner) redirect("/dashboard");
  return userId;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { msg?: string; error?: string } | Promise<{ msg?: string; error?: string }>;
}) {
  const userId = await requireAdmin();
  void userId;

  const resolved = searchParams ? await Promise.resolve(searchParams) : {};

  const [tournaments, users, allParticipants, allDrafts, pickCountsRaw] = await Promise.all([
    prisma.tournament.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, year: true, type: true, status: true, draftDate: true, inviteToken: true, teamsPerPlayer: true, pickSeconds: true, payoutRules: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isAdmin: true } }),
    prisma.tournamentParticipant.findMany({ select: { tournamentId: true, userId: true } }),
    prisma.tournamentDraft.findMany({ select: { tournamentId: true, status: true, currentPick: true, orderUserIds: true } }),
    prisma.lineupPick.groupBy({ by: ["tournamentId"], _count: { id: true } }),
  ]);

  const activeTournament = tournaments.find((t) => ["draft", "active"].includes(t.status)) ?? null;

  const draftByTournament = new Map(allDrafts.map((d) => [d.tournamentId, d]));
  const pickCountByTournament = new Map(pickCountsRaw.map((r) => [r.tournamentId, r._count.id]));

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const siteBase = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  const userById = new Map(users.map((u) => [u.id, u]));
  // Map tournamentId → Set of enrolled userIds
  const participantsByTournament = new Map<string, Set<string>>();
  for (const p of allParticipants) {
    const s = participantsByTournament.get(p.tournamentId) ?? new Set<string>();
    s.add(p.userId);
    participantsByTournament.set(p.tournamentId, s);
  }

  // ─── Server Actions ───────────────────────────────────────────────────────

  async function createTournamentAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "world_cup").trim();
    const year = Number(formData.get("year") ?? 2026);
    const teamsPerPlayer = Number(formData.get("teamsPerPlayer") ?? 4);
    if (!name) redirect("/admin?error=Name+required");

    await prisma.tournament.create({
      data: { name, type, year, teamsPerPlayer, status: "upcoming" },
    });
    redirect("/admin?msg=Tournament+created");
  }

  async function generateInviteAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin");
    const token = crypto.randomUUID().replace(/-/g, "");
    await prisma.tournament.update({ where: { id }, data: { inviteToken: token } });
    redirect("/admin?msg=Invite+link+generated");
  }

  async function addParticipantAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const userId = String(formData.get("userId") ?? "").trim();
    if (!tournamentId || !userId) redirect("/admin");
    await prisma.tournamentParticipant.upsert({
      where: { tournamentId_userId: { tournamentId, userId } },
      create: { tournamentId, userId },
      update: {},
    });
    redirect("/admin?msg=Player+added");
  }

  async function removeParticipantAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const userId = String(formData.get("userId") ?? "").trim();
    if (!tournamentId || !userId) redirect("/admin");
    await prisma.tournamentParticipant.delete({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    redirect("/admin?msg=Player+removed");
  }

  async function setDraftDateAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const raw = String(formData.get("draftDate") ?? "").trim();
    if (!id) redirect("/admin");
    // datetime-local input is in PST (PDT = UTC-7 for June/July 2026)
    const draftDate = raw ? new Date(raw + ":00-07:00") : null;
    await prisma.tournament.update({ where: { id }, data: { draftDate } });
    redirect("/admin?msg=Draft+date+saved");
  }

  async function deleteTournamentAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin");
    const [tournament, picks] = await Promise.all([
      prisma.tournament.findUnique({ where: { id }, select: { status: true } }),
      prisma.lineupPick.count({ where: { tournamentId: id } }),
    ]);
    if (!tournament) redirect("/admin?error=Tournament+not+found");
    if (tournament.status !== "upcoming" || picks > 0) {
      redirect("/admin?error=Cannot+delete+a+tournament+with+picks+or+past+upcoming+status");
    }
    await prisma.tournament.delete({ where: { id } });
    redirect("/admin?msg=Tournament+deleted");
  }

  async function startDraftAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    if (!tournamentId) redirect("/admin");
    const rawOrder = String(formData.get("orderUserIds") ?? "").trim();
    let manualOrder: string[] | undefined;
    if (rawOrder) {
      try { manualOrder = JSON.parse(rawOrder) as string[]; } catch { /* ignore */ }
    }
    let draftOrder: string[] = [];
    try {
      draftOrder = await activateDraft(tournamentId, manualOrder);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "NO_PARTICIPANTS") redirect("/admin?error=No+participants+enrolled+yet");
      if (msg === "INVALID_ORDER") redirect("/admin?error=Invalid+draft+order+submitted");
      redirect("/admin?error=Could+not+start+draft");
    }
    // Discord notification — fire-and-forget
    try {
      const hdrs2 = await headers();
      const host = hdrs2.get("host") ?? "localhost:3000";
      const proto = hdrs2.get("x-forwarded-proto") ?? "http";
      const siteBase = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
      const [t, orderedUsers] = await Promise.all([
        prisma.tournament.findUnique({ where: { id: tournamentId }, select: { name: true, year: true } }),
        prisma.user.findMany({ where: { id: { in: draftOrder } }, select: { id: true, name: true, email: true } }),
      ]);
      if (t && draftOrder.length > 0) {
        const uMap = new Map(orderedUsers.map((u) => [u.id, u]));
        await postDraftStarted({
          tournamentName: `${t.name} ${t.year}`,
          order: draftOrder.map((id) => { const u = uMap.get(id); return { name: u?.name ?? u?.email ?? "?" }; }),
          draftUrl: `${siteBase}/draft`,
        });
      }
    } catch { /* ignore Discord failures */ }
    redirect("/admin?msg=Draft+started");
  }

  async function setTournamentStatusAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!tournamentId || !status) redirect("/admin");
    const allowed = ["upcoming", "draft", "active", "complete"];
    if (!allowed.includes(status)) redirect("/admin?error=Invalid+status");
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status } });
    redirect("/admin?msg=Status+updated");
  }

  async function resetDraftAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    if (!tournamentId) redirect("/admin");
    try {
      await resetDraftOrder(tournamentId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PICKS_MADE") redirect("/admin?error=Cannot+re-randomize+after+picks+are+made");
      if (msg === "NO_DRAFT") redirect("/admin?error=No+draft+record+found");
      redirect("/admin?error=Could+not+re-randomize");
    }
    redirect("/admin?msg=Draft+order+re-randomized");
  }

  async function setDraftOrderAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    if (!tournamentId) redirect("/admin");
    const rawOrder = String(formData.get("orderUserIds") ?? "").trim();
    let manualOrder: string[] | undefined;
    try { manualOrder = JSON.parse(rawOrder) as string[]; } catch { redirect("/admin?error=Invalid+order+data"); }
    try {
      await resetDraftOrder(tournamentId, manualOrder);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "PICKS_MADE") redirect("/admin?error=Cannot+change+order+after+picks+are+made");
      if (msg === "NO_DRAFT") redirect("/admin?error=No+draft+record+found");
      if (msg === "INVALID_ORDER") redirect("/admin?error=Invalid+draft+order+submitted");
      redirect("/admin?error=Could+not+save+order");
    }
    redirect("/admin?msg=Draft+order+saved");
  }

  async function resetToUpcomingAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin");
    // Safety: refuse if any picks have been made
    const picks = await prisma.lineupPick.count({ where: { tournamentId: id } });
    if (picks > 0) redirect("/admin?error=Cannot+reset+a+tournament+that+has+picks");
    await prisma.$transaction([
      prisma.tournamentDraft.deleteMany({ where: { tournamentId: id } }),
      prisma.tournament.update({ where: { id }, data: { status: "upcoming" } }),
    ]);
    redirect("/admin?msg=Tournament+reset+to+upcoming");
  }

  async function setPayoutRulesAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin");
    const keys = Object.keys(DEFAULT_PAYOUT_RULES) as (keyof PayoutRules)[];
    const partial: Partial<PayoutRules> = {};
    for (const key of keys) {
      const raw = String(formData.get(key) ?? "").trim();
      const dollars = parseFloat(raw);
      if (!isNaN(dollars) && dollars >= 0) {
        partial[key] = Math.round(dollars * 100) as never;
      }
    }
    await prisma.tournament.update({ where: { id }, data: { payoutRules: partial } });
    redirect("/admin?msg=Payout+rules+saved");
  }

  async function setPickSecondsAction(formData: FormData) {    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const raw = String(formData.get("pickSeconds") ?? "").trim();
    if (!id) redirect("/admin");
    // Empty string or "unlimited" → null (unlimited); otherwise parse as int
    const pickSeconds = raw === "" || raw === "unlimited" ? null : Math.max(1, parseInt(raw, 10));
    await prisma.tournament.update({ where: { id }, data: { pickSeconds } });
    redirect("/admin?msg=Pick+timer+saved");
  }

  async function toggleAdminAction(formData: FormData) {    "use server";
    await requireAdmin();
    const uid = String(formData.get("userId") ?? "").trim();
    if (!uid) redirect("/admin");
    const target = await prisma.user.findUnique({ where: { id: uid }, select: { isAdmin: true } });
    if (!target) redirect("/admin?error=User+not+found");
    await prisma.user.update({ where: { id: uid }, data: { isAdmin: !target.isAdmin } });
    redirect("/admin?msg=Admin+updated");
  }

  async function addAdjustmentAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const uid = String(formData.get("userId") ?? "").trim();
    const amountStr = String(formData.get("amount") ?? "0").trim();
    const reason = String(formData.get("reason") ?? "").trim() || "Manual adjustment";
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    if (!tournamentId || !uid || !Number.isFinite(amountCents)) redirect("/admin?error=Invalid+fields");
    await prisma.earningsAdjustment.create({
      data: { tournamentId, userId: uid, amountCents, reason },
    });
    redirect("/admin?msg=Adjustment+added");
  }

  const input = "h-10 rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500";
  const select = "rounded-xl border border-zinc-300 dark:border-white/10 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-white outline-none";
  const section = "rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-6";
  const sectionTitle = "text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400";
  const ghostBtn = "rounded-lg bg-zinc-100 dark:bg-white/10 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/20";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold text-zinc-900 dark:text-white">Admin Panel</h1>

      {resolved.msg && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {resolved.msg}
        </div>
      )}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {resolved.error}
        </div>
      )}

      {/* ── Create Tournament ── */}
      <section className={`mb-8 ${section}`}>
        <h2 className={`mb-4 ${sectionTitle}`}>Create Tournament</h2>
        <form action={createTournamentAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input name="name" placeholder="Tournament name" required className={`${input} col-span-2`} />
          <select name="type" className={`h-10 ${select}`}>
            <option value="world_cup">World Cup</option>
            <option value="euros">Euros</option>
          </select>
          <input name="year" type="number" defaultValue={2026} placeholder="Year" className={input} />
          <input name="teamsPerPlayer" type="number" defaultValue={4} placeholder="Teams/player" className={input} />
          <button type="submit" className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
            Create
          </button>
        </form>
      </section>

      {/* ── Tournaments List ── */}
      <section className={`mb-8 ${section}`}>
        <h2 className={`mb-4 ${sectionTitle}`}>Tournaments</h2>
        <div className="space-y-3">
          {tournaments.map((t) => {
            const enrolled = participantsByTournament.get(t.id) ?? new Set<string>();
            const enrolledUsers = [...enrolled].map((uid) => userById.get(uid)).filter(Boolean);
            const unenrolled = users.filter((u) => !enrolled.has(u.id));
            const draftRecord = draftByTournament.get(t.id);
            const pickCount = pickCountByTournament.get(t.id) ?? 0;
            const draftOrderIds = (draftRecord?.orderUserIds as string[] | undefined) ?? [];
            const maxPicks = Math.min(enrolled.size * t.teamsPerPlayer, TEAMS.length);
            return (
              <div key={t.id} className="rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-white/5 px-4 py-3 text-sm space-y-3">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-zinc-900 dark:text-white">{t.name} {t.year}</span>
                  <span className="rounded-full bg-zinc-200 dark:bg-white/10 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 capitalize">{t.type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    t.status === "active" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                    t.status === "draft"  ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                    t.status === "complete" ? "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300" :
                    "bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400"
                  }`}>{t.status}</span>
                  <form action={setDraftDateAction} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="text-xs text-zinc-500 dark:text-zinc-500">Draft date (PST)</label>
                    <input
                      type="datetime-local"
                      name="draftDate"
                      defaultValue={t.draftDate
                        ? t.draftDate.toLocaleString("sv-SE", { timeZone: "America/Los_Angeles" }).slice(0, 16)
                        : ""}
                      className="h-8 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-zinc-800 px-2 text-xs text-zinc-900 dark:text-white outline-none"
                    />
                    <button type="submit" className={`h-8 ${ghostBtn}`}>Save</button>
                  </form>
                  <form action={setPickSecondsAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <label className="text-xs text-zinc-500 dark:text-zinc-500">Pick timer</label>
                    <select
                      name="pickSeconds"
                      defaultValue={t.pickSeconds != null ? String(t.pickSeconds) : "unlimited"}
                      className={`h-8 ${select}`}
                    >
                      <option value="unlimited">Unlimited</option>
                      <option value="30">30s</option>
                      <option value="60">60s</option>
                      <option value="90">90s</option>
                      <option value="120">2m</option>
                      <option value="300">5m</option>
                    </select>
                    <button type="submit" className={`h-8 ${ghostBtn}`}>Save</button>
                  </form>
                  {t.status === "upcoming" && pickCount === 0 ? (
                    <form action={deleteTournamentAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmSubmitButton
                        confirmText={`Delete "${t.name} ${t.year}"?`}
                        className="h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 ring-1 ring-rose-200 dark:ring-rose-500/20"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-400 dark:text-zinc-600 italic" title="Tournaments with picks or active/complete status cannot be deleted here.">
                      🔒 Locked
                    </span>
                  )}
                </div>

                {/* Invite link row */}
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 shrink-0">Invite link:</span>
                  {t.inviteToken ? (
                    <>
                      <span className="flex-1 truncate rounded-lg bg-zinc-100 dark:bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-700 dark:text-zinc-300 min-w-0">
                        {`${siteBase}/invite/${t.inviteToken}`}
                      </span>
                      <CopyButton
                        text={`${siteBase}/invite/${t.inviteToken}`}
                        className="h-7 rounded-lg bg-sky-50 dark:bg-sky-500/15 px-3 text-xs font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/25 shrink-0"
                      />
                      <form action={generateInviteAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="h-7 rounded-lg bg-zinc-100 dark:bg-white/5 px-3 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0">
                          Regenerate
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={generateInviteAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="h-7 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">
                        Generate invite link
                      </button>
                    </form>
                  )}
                </div>

                {/* Participants row */}
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 shrink-0">Players:</span>
                  {enrolledUsers.length === 0 && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">None enrolled yet</span>
                  )}
                  {enrolledUsers.map((u) => u && (
                    <form key={u.id} action={removeParticipantAction} className="flex items-center">
                      <input type="hidden" name="tournamentId" value={t.id} />
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-full bg-zinc-200 dark:bg-white/10 pl-2.5 pr-1.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
                        title="Remove from tournament"
                      >
                        {u.name ?? u.email}
                        <span className="text-[10px] font-bold ml-0.5">✕</span>
                      </button>
                    </form>
                  ))}
                  {unenrolled.length > 0 && (
                    <form action={addParticipantAction} className="flex items-center gap-1.5 ml-1">
                      <input type="hidden" name="tournamentId" value={t.id} />
                      <select name="userId" className={`h-7 ${select}`}>
                        {unenrolled.map((u) => (
                          <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                        ))}
                      </select>
                      <button type="submit" className="h-7 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700">
                        + Add
                      </button>
                    </form>
                  )}
                </div>

                {/* Draft controls row */}
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 shrink-0">Draft:</span>

                  {t.status === "upcoming" && !draftRecord && (
                    <>
                      <span className="text-xs text-zinc-400 dark:text-zinc-600">
                        {enrolled.size === 0
                          ? "Enroll players to enable draft"
                          : `${enrolled.size} player${enrolled.size !== 1 ? "s" : ""} enrolled — set order below`}
                      </span>
                      {enrolled.size >= 1 && (
                        <div className="w-full mt-2">
                          <DraftOrderPicker
                            tournamentId={t.id}
                            players={enrolledUsers.filter(Boolean).map((u) => ({ id: u!.id, label: u!.name ?? u!.email ?? u!.id }))}
                            action={startDraftAction}
                            submitLabel="Start Draft with This Order"
                          />
                          <form action={startDraftAction} className="mt-2">
                            <input type="hidden" name="tournamentId" value={t.id} />
                            <button type="submit" className="h-7 w-full rounded-lg bg-zinc-200 dark:bg-white/10 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-white/20">
                              🔀 Randomize &amp; Start Draft
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  )}

                  {t.status === "upcoming" && draftRecord && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-600 italic">Draft record exists (will activate at scheduled time)</span>
                  )}

                  {t.status === "draft" && draftRecord && (
                    <>
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        Pick {draftRecord.currentPick} of {maxPicks}
                        {pickCount === 0 && " · no picks yet"}
                      </span>
                      {pickCount > 0 && draftOrderIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {draftOrderIds.map((uid, idx) => {
                            const u = userById.get(uid);
                            return (
                              <span key={uid} className="rounded-full bg-zinc-200 dark:bg-white/10 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                                {idx + 1}. {u?.name ?? u?.email ?? "?"}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {pickCount === 0 && draftOrderIds.length > 0 && (
                        <div className="w-full mt-2">
                          <DraftOrderPicker
                            tournamentId={t.id}
                            players={draftOrderIds.map((uid) => {
                              const u = userById.get(uid);
                              return { id: uid, label: u?.name ?? u?.email ?? uid };
                            })}
                            action={setDraftOrderAction}
                            submitLabel="Save Order"
                          />
                          <form action={resetDraftAction} className="mt-2">
                            <input type="hidden" name="tournamentId" value={t.id} />
                            <button type="submit" className="h-7 w-full rounded-lg bg-zinc-200 dark:bg-white/10 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-white/20">
                              🔀 Re-randomize
                            </button>
                          </form>
                        </div>
                      )}
                      <form action={setTournamentStatusAction}>
                        <input type="hidden" name="tournamentId" value={t.id} />
                        <input type="hidden" name="status" value="active" />
                        <button type="submit" className="h-7 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                          Set Active →
                        </button>
                      </form>
                    </>
                  )}

                  {t.status === "active" && (
                    <form action={setTournamentStatusAction}>
                      <input type="hidden" name="tournamentId" value={t.id} />
                      <input type="hidden" name="status" value="complete" />
                      <button type="submit" className="h-7 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700">
                        Complete Tournament
                      </button>
                    </form>
                  )}

                  {(t.status === "active" || t.status === "complete") && pickCount === 0 && (
                    <form action={resetToUpcomingAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmSubmitButton
                        confirmText="Reset this tournament back to upcoming? The draft record will be cleared but all enrolled players will remain."
                        className="h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 ring-1 ring-amber-200 dark:ring-amber-500/20"
                      >
                        ↩ Reset to Upcoming
                      </ConfirmSubmitButton>
                    </form>
                  )}

                  {t.status === "complete" && (
                    <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">Tournament complete</span>
                  )}
                </div>

                {/* Payout Rules row */}
                {(() => {
                  const pr = resolvePayoutRules(t.payoutRules as Partial<PayoutRules> | null);
                  const isWC = t.type === "world_cup";
                  type RuleField = { key: keyof PayoutRules; label: string; show?: boolean };
                  const fields: RuleField[] = [
                    { key: "groupWinBase",          label: "Group Stage: Win base ($)" },
                    { key: "groupWinGdPer",         label: "Group Stage: Bonus per goal diff ($)" },
                    { key: "groupDraw",             label: "Group Stage: Draw ($)" },
                    { key: "r32WinBase",            label: "Round of 32: Win base ($)", show: isWC },
                    { key: "r32WinGdPer",           label: "Round of 32: Bonus per goal diff ($)", show: isWC },
                    { key: "r16WinBase",            label: "Round of 16: Win base ($)" },
                    { key: "r16WinGdPer",           label: "Round of 16: Bonus per goal diff ($)" },
                    { key: "qfWinBase",             label: "Quarter Final: Win base ($)" },
                    { key: "qfWinGdPer",            label: "Quarter Final: Bonus per goal diff ($)" },
                    { key: "sfWinBase",             label: "Semi Final: Win base ($)" },
                    { key: "sfWinGdPerWC",          label: "Semi Final: Bonus per goal diff — World Cup ($)", show: isWC },
                    { key: "sfWinGdPerEuros",       label: "Semi Final: Bonus per goal diff — Euros ($)", show: !isWC },
                    { key: "thirdWinBase",          label: "3rd Place: Win base ($)", show: isWC },
                    { key: "thirdWinGdPer",         label: "3rd Place: Bonus per goal diff ($)", show: isWC },
                    { key: "finalWinnerBase",       label: "Final: Winner base ($)" },
                    { key: "finalWinnerGoalPer",    label: "Final: Winner bonus per goal scored ($)" },
                    { key: "finalRunnerUpBase",     label: "Final: Runner-up base ($)" },
                    { key: "finalRunnerUpGoalPer",  label: "Final: Runner-up bonus per goal scored ($)" },
                    { key: "upsetBonus1Tier",       label: "Group Stage: Upset bonus — winner 1 tier worse ($)" },
                    { key: "upsetBonus2Tier",       label: "Group Stage: Upset bonus — winner 2 tiers worse ($)" },
                    { key: "upsetBonus3Tier",       label: "Group Stage: Upset bonus — winner 3+ tiers worse ($)" },
                  ];
                  return (
                    <div className="border-t border-zinc-100 dark:border-white/5 pt-2">
                      <details className="group">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 select-none flex items-center gap-1">
                          <span className="group-open:hidden">▶</span><span className="hidden group-open:inline">▼</span>
                          💰 Payout Rules
                        </summary>
                        <form action={setPayoutRulesAction} className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input type="hidden" name="id" value={t.id} />
                          {fields.filter((f) => f.show !== false).map((f) => (
                            <div key={f.key} className="flex flex-col gap-1">
                              <label className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</label>
                              <input
                                name={f.key}
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={(pr[f.key] / 100).toFixed(2)}
                                className={`${input} w-full`}
                              />
                            </div>
                          ))}
                          <div className="col-span-full flex gap-2 mt-1">
                            <button type="submit" className="h-8 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700">
                              Save Payout Rules
                            </button>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center">Affects all earnings calculations for this tournament.</span>
                          </div>
                        </form>
                      </details>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {tournaments.length === 0 && <p className="text-zinc-500 dark:text-zinc-500 text-sm">No tournaments yet.</p>}
        </div>
      </section>

      {/* ── Match Management ── */}
      <section className={`mb-8 ${section}`}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Match Management</h2>
          <Link
            href="/admin/matches"
            className="inline-flex h-9 items-center rounded-xl bg-sky-50 dark:bg-sky-500/15 px-4 text-sm font-semibold text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30 hover:bg-sky-100 dark:hover:bg-sky-500/25"
          >
            Edit Match Results
          </Link>
        </div>
        {!activeTournament && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">No active tournament. Create and activate one to manage matches.</p>
        )}
        {activeTournament && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Active: <span className="font-semibold text-zinc-900 dark:text-white">{activeTournament.name} {activeTournament.year}</span>
          </p>
        )}
      </section>

      {activeTournament && (
        <section className={`mb-8 ${section}`}>
          <h2 className={`mb-4 ${sectionTitle}`}>Manual Earnings Adjustment</h2>
          <form action={addAdjustmentAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="tournamentId" value={activeTournament.id} />
            <select name="userId" className={`h-10 ${select}`}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
            <input name="amount" type="number" step="0.01" placeholder="Amount $" className={input} />
            <input name="reason" placeholder="Reason (e.g. odds jump bonus)" className={input} />
            <button type="submit" className="h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600">
              Add Adjustment
            </button>
          </form>
        </section>
      )}

      {/* ── Users / Admins ── */}
      <section className={section}>
        <h2 className={`mb-4 ${sectionTitle}`}>Users</h2>
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-white/5 px-4 py-2 text-sm">
              <span className="flex-1 font-medium text-zinc-900 dark:text-white">{u.name ?? u.email}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">{u.email}</span>
              {u.isAdmin && <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">admin</span>}
              <form action={toggleAdminAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button type="submit" className={`h-7 ${ghostBtn}`}>
                  {u.isAdmin ? "Revoke admin" : "Make admin"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
