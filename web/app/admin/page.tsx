import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwner } from "@/lib/siteOwner";
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

  const [tournaments, users, allParticipants] = await Promise.all([
    prisma.tournament.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, year: true, type: true, status: true, draftDate: true, inviteToken: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isAdmin: true } }),
    prisma.tournamentParticipant.findMany({ select: { tournamentId: true, userId: true } }),
  ]);

  const activeTournament = tournaments.find((t) => ["draft", "active"].includes(t.status)) ?? null;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const siteBase = `${proto}://${host}`;

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
    await prisma.tournament.delete({ where: { id } });
    redirect("/admin?msg=Tournament+deleted");
  }

  async function toggleAdminAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const uid = String(formData.get("userId") ?? "").trim();
    const current = formData.get("currentAdmin") === "true";
    if (!uid) redirect("/admin");
    await prisma.user.update({ where: { id: uid }, data: { isAdmin: !current } });
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
                  <form action={deleteTournamentAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmSubmitButton
                      confirmText={`Delete "${t.name} ${t.year}"? This will permanently remove all picks, matches, and draft data.`}
                      className="h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 ring-1 ring-rose-200 dark:ring-rose-500/20"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
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
                <input type="hidden" name="currentAdmin" value={String(u.isAdmin)} />
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
