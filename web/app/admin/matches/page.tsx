import { redirect } from "next/navigation";
import Link from "next/link";
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

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams?: { msg?: string; error?: string; tournamentId?: string } | Promise<{ msg?: string; error?: string; tournamentId?: string }>;
}) {
  await requireAdmin();

  const resolved = searchParams ? await Promise.resolve(searchParams) : {};

  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, year: true, status: true },
  });

  const selectedId = resolved.tournamentId
    ?? tournaments.find((t) => ["draft", "active"].includes(t.status))?.id
    ?? tournaments[0]?.id;

  const selectedTournament = tournaments.find((t) => t.id === selectedId) ?? null;

  const matches = selectedTournament
    ? await prisma.match.findMany({
        where: { tournamentId: selectedTournament.id },
        orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
        select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true, matchDate: true, venue: true },
      })
    : [];

  // Editable: no date, OR date falls on yesterday or today (full days)
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfYesterday = new Date(endOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  startOfYesterday.setHours(0, 0, 0, 0);
  const pastMatches = matches.filter((m) => !m.matchDate || m.matchDate <= endOfToday);
  const upcomingMatches = matches.filter((m) => m.matchDate && m.matchDate > endOfToday);

  const redirectBase = selectedTournament
    ? `/admin/matches?tournamentId=${selectedTournament.id}`
    : "/admin/matches";

  // ─── Server Actions ───────────────────────────────────────────────────────

  async function addMatchAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const stage = String(formData.get("stage") ?? "").trim();
    const groupName = String(formData.get("groupName") ?? "").trim() || null;
    const homeTeam = String(formData.get("homeTeam") ?? "").trim().toLowerCase();
    const awayTeam = String(formData.get("awayTeam") ?? "").trim().toLowerCase();
    if (!tournamentId || !stage || !homeTeam || !awayTeam)
      redirect(`${redirectBase}&error=Missing+fields`);
    await prisma.match.create({
      data: { tournamentId, stage, groupName, homeTeam, awayTeam },
    });
    redirect(`${redirectBase}&msg=Match+added`);
  }

  async function updateMatchResultAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const homeScore = Number(formData.get("homeScore") ?? 0);
    const awayScore = Number(formData.get("awayScore") ?? 0);
    const penaltyWinner = String(formData.get("penaltyWinner") ?? "").trim() || null;
    const venue = String(formData.get("venue") ?? "").trim() || null;
    if (!id) redirect(`${redirectBase}&error=Missing+id`);
    await prisma.match.update({
      where: { id },
      data: { homeScore, awayScore, penaltyWinner, played: true, venue },
    });
    redirect(`${redirectBase}&msg=Result+saved`);
  }

  async function updateVenueAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const venue = String(formData.get("venue") ?? "").trim() || null;
    if (!id) redirect(redirectBase);
    await prisma.match.update({ where: { id }, data: { venue } });
    redirect(`${redirectBase}&msg=Venue+saved`);
  }

  async function deleteMatchAction(formData: FormData) {
    "use server";
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect(redirectBase);
    await prisma.match.delete({ where: { id } });
    redirect(`${redirectBase}&msg=Match+deleted`);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs font-medium text-zinc-300 hover:bg-white/20"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl font-extrabold text-white">Edit Match Results</h1>
      </div>

      {resolved.msg && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {resolved.msg}
        </div>
      )}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {resolved.error}
        </div>
      )}

      {/* ── Tournament Selector ── */}
      {tournaments.length > 1 && (
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-zinc-400">Tournament:</label>
            <select
              name="tournamentId"
              defaultValue={selectedId}
              className="h-9 rounded-lg border border-white/10 bg-zinc-800 px-3 text-sm text-white outline-none"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.year} ({t.status})
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-white/10 px-4 text-sm font-medium text-zinc-300 hover:bg-white/20">
              Switch
            </button>
          </form>
        </section>
      )}

      {!selectedTournament ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center text-zinc-500">
          No tournaments found. Create one in the Admin panel first.
        </div>
      ) : (
        <>
          {/* ── Add Match ── */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Add Match — {selectedTournament.name} {selectedTournament.year}
            </h2>
            <form action={addMatchAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="tournamentId" value={selectedTournament.id} />
              <select name="stage" className="h-10 rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-white outline-none">
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <input name="groupName" placeholder="Group (e.g. A)" maxLength={4}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-500" />
              <select name="homeTeam" className="h-10 rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-white outline-none">
                {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <select name="awayTeam" className="h-10 rounded-xl border border-white/10 bg-zinc-800 px-3 text-sm text-white outline-none">
                {TEAMS.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
              <button type="submit" className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 sm:col-span-2 lg:col-span-1">
                Add Match
              </button>
            </form>
          </section>

          {/* ── Match Results ── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                Edit Match Results
              </h2>
              <span className="font-normal normal-case text-xs text-zinc-600">
                {pastMatches.length} past match{pastMatches.length !== 1 ? "es" : ""}
                {upcomingMatches.length > 0 && ` · ${upcomingMatches.length} upcoming`}
              </span>
            </div>
            <div className="space-y-2">
              {pastMatches.map((m) => {
                const home = TEAMS_BY_CODE.get(m.homeTeam);
                const away = TEAMS_BY_CODE.get(m.awayTeam);
                return (
                  <div key={m.id} className="rounded-xl bg-white/5 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-400 uppercase">{m.stage}</span>
                      {m.groupName && <span>Group {m.groupName}</span>}
                      {m.matchDate && <span>{new Date(m.matchDate).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" })}</span>}
                      {m.played && <span className="text-emerald-400">✓ played</span>}
                    </div>
                    <form action={updateMatchResultAction} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="hidden" name="id" value={m.id} />
                      <span className="font-semibold text-white min-w-[6rem]">{home?.name ?? m.homeTeam}</span>
                      <input type="number" name="homeScore" min={0} max={30} defaultValue={m.homeScore ?? 0}
                        className="h-8 w-14 rounded-lg border border-white/10 bg-zinc-800 text-center text-sm text-white outline-none" />
                      <span className="text-zinc-500">–</span>
                      <input type="number" name="awayScore" min={0} max={30} defaultValue={m.awayScore ?? 0}
                        className="h-8 w-14 rounded-lg border border-white/10 bg-zinc-800 text-center text-sm text-white outline-none" />
                      <span className="font-semibold text-white min-w-[6rem]">{away?.name ?? m.awayTeam}</span>
                      <select name="penaltyWinner" defaultValue={m.penaltyWinner ?? ""}
                        className="h-8 rounded-lg border border-white/10 bg-zinc-800 px-2 text-xs text-white outline-none">
                        <option value="">No pens</option>
                        <option value={m.homeTeam}>{home?.name ?? m.homeTeam} wins pens</option>
                        <option value={m.awayTeam}>{away?.name ?? m.awayTeam} wins pens</option>
                      </select>
                      <input
                        type="text"
                        name="venue"
                        placeholder="Venue (e.g. MetLife Stadium)"
                        defaultValue={m.venue ?? ""}
                        className="h-8 min-w-[10rem] flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 text-xs text-white outline-none placeholder:text-zinc-600"
                      />
                      <button type="submit" className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">Save</button>
                    </form>
                    <form action={deleteMatchAction} className="mt-1">
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-[11px] text-zinc-600 hover:text-rose-400">Delete match</button>
                    </form>
                  </div>
                );
              })}
              {pastMatches.length === 0 && (
                <p className="text-zinc-500 text-sm">
                  {matches.length === 0
                    ? "No matches yet. Add one above."
                    : "No past matches yet — results can be entered once a match date has passed."}
                </p>
              )}
            </div>
          </section>

          {/* ── Upcoming — Venue Only ── */}
          {upcomingMatches.length > 0 && (
            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
                Upcoming Matches — Set Venue
              </h2>
              <div className="space-y-2">
                {upcomingMatches.map((m) => {
                  const home = TEAMS_BY_CODE.get(m.homeTeam);
                  const away = TEAMS_BY_CODE.get(m.awayTeam);
                  return (
                    <div key={m.id} className="rounded-xl bg-white/5 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-400 uppercase">{m.stage}</span>
                        {m.groupName && <span>Group {m.groupName}</span>}
                        {m.matchDate && <span>{new Date(m.matchDate).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</span>}
                      </div>
                      <form action={updateVenueAction} className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="hidden" name="id" value={m.id} />
                        <span className="font-semibold text-white min-w-[6rem]">{home?.name ?? m.homeTeam}</span>
                        <span className="text-zinc-500">vs</span>
                        <span className="font-semibold text-white min-w-[6rem]">{away?.name ?? m.awayTeam}</span>
                        <input
                          type="text"
                          name="venue"
                          placeholder="Venue (e.g. MetLife Stadium)"
                          defaultValue={m.venue ?? ""}
                          className="h-8 min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 text-xs text-white outline-none placeholder:text-zinc-600"
                        />
                        <button type="submit" className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-700">Save venue</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
