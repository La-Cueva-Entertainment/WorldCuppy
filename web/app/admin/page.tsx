import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { isSiteOwner } from "@/lib/siteOwner";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGES = [
  { value: "group", label: "Group Stage" },
  { value: "r32", label: "Round of 32" },
  { value: "r16", label: "Round of 16" },
  { value: "qf", label: "Quarter Final" },
  { value: "sf", label: "Semi Final" },
  { value: "3rd", label: "3rd Place" },
  { value: "final", label: "Final" },
];

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

  const [tournaments, users] = await Promise.all([
    prisma.tournament.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, year: true, type: true, status: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isAdmin: true } }),
  ]);

  const activeTournament = tournaments.find((t) => ["draft", "active"].includes(t.status)) ?? null;
  const matches = activeTournament
    ? await prisma.match.findMany({
        where: { tournamentId: activeTournament.id },
        orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true },
      })
    : [];

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

  async function setTournamentStatusAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!id || !status) redirect("/admin");
    await prisma.tournament.update({ where: { id }, data: { status } });
    redirect("/admin?msg=Status+updated");
  }

  async function addMatchAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const stage = String(formData.get("stage") ?? "").trim();
    const groupName = String(formData.get("groupName") ?? "").trim() || null;
    const homeTeam = String(formData.get("homeTeam") ?? "").trim().toLowerCase();
    const awayTeam = String(formData.get("awayTeam") ?? "").trim().toLowerCase();
    if (!tournamentId || !stage || !homeTeam || !awayTeam) redirect("/admin?error=Missing+fields");
    await prisma.match.create({
      data: { tournamentId, stage, groupName, homeTeam, awayTeam },
    });
    redirect("/admin?msg=Match+added");
  }

  async function updateMatchResultAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const homeScore = Number(formData.get("homeScore") ?? 0);
    const awayScore = Number(formData.get("awayScore") ?? 0);
    const penaltyWinner = String(formData.get("penaltyWinner") ?? "").trim() || null;
    if (!id) redirect("/admin?error=Missing+id");
    await prisma.match.update({
      where: { id },
      data: { homeScore, awayScore, penaltyWinner, played: true },
    });
    redirect("/admin?msg=Result+saved");
  }

  async function deleteMatchAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/admin");
    await prisma.match.delete({ where: { id } });
    redirect("/admin?msg=Match+deleted");
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold text-white">Admin Panel</h1>

      {resolved.msg && (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {resolved.msg}
        </div>
      )}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {resolved.error}
        </div>
      )}

      {/* ── Create Tournament ── */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Create Tournament</h2>
        <form action={createTournamentAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input name="name" placeholder="Tournament name" required
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500/40 col-span-2" />
          <select name="type" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none">
            <option value="world_cup">World Cup</option>
            <option value="euros">Euros</option>
          </select>
          <input name="year" type="number" defaultValue={2026} placeholder="Year"
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none" />
          <input name="teamsPerPlayer" type="number" defaultValue={4} placeholder="Teams/player"
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none" />
          <button type="submit" className="h-10 rounded-xl bg-green-500/20 px-4 text-sm font-semibold text-green-300 ring-1 ring-green-500/40 hover:bg-green-500/30">
            Create
          </button>
        </form>
      </section>

      {/* ── Tournaments List ── */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Tournaments</h2>
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/20 px-4 py-2 text-sm">
              <span className="font-semibold text-white">{t.name} {t.year}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-400 capitalize">{t.type}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                t.status === "active" ? "bg-green-500/20 text-green-300" :
                t.status === "draft" ? "bg-amber-500/20 text-amber-300" :
                t.status === "complete" ? "bg-sky-500/20 text-sky-300" :
                "bg-white/10 text-zinc-400"
              }`}>{t.status}</span>
              <form action={setTournamentStatusAction} className="ml-auto flex items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <select name="status" defaultValue={t.status}
                  className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none">
                  <option value="upcoming">upcoming</option>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="complete">complete</option>
                </select>
                <button type="submit" className="h-8 rounded-lg bg-white/10 px-3 text-xs font-medium text-white hover:bg-white/15">Set</button>
              </form>
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-zinc-500 text-sm">No tournaments yet.</p>}
        </div>
      </section>

      {activeTournament && (
        <>
          {/* ── Add Match ── */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Add Match — {activeTournament.name} {activeTournament.year}
            </h2>
            <form action={addMatchAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="tournamentId" value={activeTournament.id} />
              <select name="stage" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none">
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input name="groupName" placeholder="Group (e.g. A)" maxLength={4}
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              <select name="homeTeam" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none">
                {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <select name="awayTeam" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none">
                {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <button type="submit" className="h-10 rounded-xl bg-green-500/20 px-4 text-sm font-semibold text-green-300 ring-1 ring-green-500/40 hover:bg-green-500/30 sm:col-span-2 lg:col-span-1">
                Add Match
              </button>
            </form>
          </section>

          {/* ── Match Results ── */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Match Results</h2>
            <div className="space-y-2">
              {matches.map((m) => {
                const home = TEAMS_BY_CODE.get(m.homeTeam);
                const away = TEAMS_BY_CODE.get(m.awayTeam);
                return (
                  <div key={m.id} className="rounded-xl bg-black/20 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-400 uppercase">{m.stage}</span>
                      {m.groupName && <span>Group {m.groupName}</span>}
                      {m.played && <span className="text-green-400">✓ played</span>}
                    </div>
                    <form action={updateMatchResultAction} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="hidden" name="id" value={m.id} />
                      <span className="font-semibold text-white min-w-[6rem]">{home?.name ?? m.homeTeam}</span>
                      <input type="number" name="homeScore" min={0} max={30} defaultValue={m.homeScore ?? 0}
                        className="h-8 w-14 rounded-lg border border-white/10 bg-black/40 text-center text-sm text-white outline-none" />
                      <span className="text-zinc-500">–</span>
                      <input type="number" name="awayScore" min={0} max={30} defaultValue={m.awayScore ?? 0}
                        className="h-8 w-14 rounded-lg border border-white/10 bg-black/40 text-center text-sm text-white outline-none" />
                      <span className="font-semibold text-white min-w-[6rem]">{away?.name ?? m.awayTeam}</span>
                      <select name="penaltyWinner" defaultValue={m.penaltyWinner ?? ""}
                        className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white outline-none">
                        <option value="">No pens</option>
                        <option value={m.homeTeam}>{home?.name ?? m.homeTeam} wins pens</option>
                        <option value={m.awayTeam}>{away?.name ?? m.awayTeam} wins pens</option>
                      </select>
                      <button type="submit" className="h-8 rounded-lg bg-green-500/20 px-3 text-xs font-medium text-green-300 hover:bg-green-500/30">Save</button>
                    </form>
                    <form action={deleteMatchAction} className="mt-1">
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-[11px] text-zinc-600 hover:text-rose-400">Delete match</button>
                    </form>
                  </div>
                );
              })}
              {matches.length === 0 && <p className="text-zinc-500 text-sm">No matches yet.</p>}
            </div>
          </section>

          {/* ── Earnings Adjustment ── */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Manual Earnings Adjustment</h2>
            <form action={addAdjustmentAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="tournamentId" value={activeTournament.id} />
              <select name="userId" className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
              <input name="amount" type="number" step="0.01" placeholder="Amount $" 
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              <input name="reason" placeholder="Reason (e.g. odds jump bonus)"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              <button type="submit" className="h-10 rounded-xl bg-amber-500/20 px-4 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30">
                Add Adjustment
              </button>
            </form>
          </section>
        </>
      )}

      {/* ── Users / Admins ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Users</h2>
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-2 text-sm">
              <span className="flex-1 text-white">{u.name ?? u.email}</span>
              <span className="text-xs text-zinc-500">{u.email}</span>
              {u.isAdmin && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">admin</span>}
              <form action={toggleAdminAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="currentAdmin" value={String(u.isAdmin)} />
                <button type="submit" className="h-7 rounded-lg bg-white/10 px-3 text-xs text-zinc-300 hover:bg-white/15">
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
