import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CopyButton } from "@/components/CopyButton";
import { ScoringConfigEditor } from "@/components/ScoringConfigEditor";
import { requireAdmin } from "@/lib/auth";
import { resolveConfig } from "@/lib/earnings";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const TOURNAMENT_PRESETS = [
  // International
  { key: "wc2026",    label: "FIFA World Cup 2026",           name: "FIFA World Cup",        type: "world_cup",          year: 2026, apiCode: "WC",  apiSeason: 2026, startDate: "2026-06-11" },
  { key: "euros2028", label: "UEFA Euro 2028",                name: "UEFA Euro",             type: "euros",              year: 2028, apiCode: "EC",  apiSeason: 2028, startDate: "2028-06-09" },
  { key: "wc2030",    label: "FIFA World Cup 2030",           name: "FIFA World Cup",        type: "world_cup",          year: 2030, apiCode: "WC",  apiSeason: 2030, startDate: "2030-06-01" },
  // Club cups
  { key: "cl2526",    label: "UEFA Champions League 2025/26", name: "UEFA Champions League", type: "champions_league",   year: 2026, apiCode: "CL",  apiSeason: 2025, startDate: "2025-09-16" },
  { key: "cli2026",   label: "Copa Libertadores 2026",        name: "Copa Libertadores",     type: "copa_libertadores",  year: 2026, apiCode: "CLI", apiSeason: 2026, startDate: "2026-02-04" },
] as const;

type PresetKey = (typeof TOURNAMENT_PRESETS)[number]["key"];


export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { msg?: string; error?: string } | Promise<{ msg?: string; error?: string }>;
}) {
  await requireAdmin();

  const resolved = searchParams ? await Promise.resolve(searchParams) : {};

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("192.168") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const [tournaments, users] = await Promise.all([
    prisma.tournament.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, year: true, type: true, status: true, poolName: true, inviteToken: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, isAdmin: true } }),
  ]);

  const activeTournament = tournaments.find((t) => ["draft", "active"].includes(t.status)) ?? null;
  const [matches, scoringConfigRow] = await Promise.all([
    activeTournament
      ? prisma.match.findMany({
          where: { tournamentId: activeTournament.id },
          orderBy: [{ matchDate: "asc" }, { createdAt: "asc" }],
          select: { id: true, stage: true, groupName: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, penaltyWinner: true, played: true },
        })
      : Promise.resolve([]),
    activeTournament
      ? prisma.scoringConfig.findUnique({ where: { tournamentId: activeTournament.id }, select: { config: true } })
      : Promise.resolve(null),
  ]);

  const scoringConfig = resolveConfig(scoringConfigRow?.config ?? null);

  // ─── Server Actions ───────────────────────────────────────────────────────

  async function createTournamentAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    const presetKey = String(formData.get("preset") ?? "").trim() as PresetKey;
    const teamsPerPlayer = Math.max(1, Number(formData.get("teamsPerPlayer") ?? 4));
    const poolName = String(formData.get("poolName") ?? "").trim() || null;
    const preset = TOURNAMENT_PRESETS.find((p) => p.key === presetKey);
    if (!preset) redirect("/admin?error=Invalid+tournament+selection");

    const { randomBytes: rb } = await import("crypto");
    const inviteToken = rb(12).toString("hex");

    const t = await prisma.tournament.create({
      data: { name: preset.name, type: preset.type, year: preset.year, teamsPerPlayer, status: "upcoming", apiCode: preset.apiCode, apiSeason: preset.apiSeason, poolName, inviteToken },
    });
    await prisma.adminAuditLog.create({ data: { adminId, action: "CREATE_TOURNAMENT", target: t.id, changes: { preset: presetKey, teamsPerPlayer, poolName } } });
    redirect("/admin?msg=Tournament+created");
  }

  async function setTournamentStatusAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (!id || !status) redirect("/admin");
    await prisma.tournament.update({ where: { id }, data: { status } });
    await prisma.adminAuditLog.create({ data: { adminId, action: "SET_TOURNAMENT_STATUS", target: id, changes: { status } } });
    redirect("/admin?msg=Status+updated");
  }


  async function updateMatchResultAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const homeScore = Number(formData.get("homeScore") ?? 0);
    const awayScore = Number(formData.get("awayScore") ?? 0);
    const penaltyWinner = String(formData.get("penaltyWinner") ?? "").trim() || null;
    if (!id) redirect("/admin?error=Missing+id");
    await prisma.match.update({ where: { id }, data: { homeScore, awayScore, penaltyWinner, played: true } });
    await prisma.adminAuditLog.create({ data: { adminId, action: "UPDATE_MATCH_RESULT", target: id, changes: { homeScore, awayScore, penaltyWinner } } });
    redirect("/admin?msg=Result+saved");
  }


  async function toggleAdminAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    const uid = String(formData.get("userId") ?? "").trim();
    const current = formData.get("currentAdmin") === "true";
    if (!uid) redirect("/admin");
    if (uid === adminId) redirect("/admin?error=Cannot+change+your+own+admin+status");
    await prisma.user.update({ where: { id: uid }, data: { isAdmin: !current } });
    await prisma.adminAuditLog.create({ data: { adminId, action: "TOGGLE_ADMIN", target: uid, changes: { isAdmin: !current } } });
    redirect("/admin?msg=Admin+updated");
  }


  async function saveScoringConfigAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    if (!activeTournament) redirect("/admin?error=No+active+tournament");

    function dollars(key: string) {
      return Math.round(parseFloat(String(formData.get(key) ?? "0")) * 100);
    }

    const config = {
      group:    { win: dollars("group_win"), draw: dollars("group_draw"), gdPerGoal: dollars("group_gdPerGoal") },
      r32r16:   { win: dollars("r32r16_win"), gdPerGoal: dollars("r32r16_gdPerGoal") },
      qf:       { win: dollars("qf_win"), gdPerGoal: dollars("qf_gdPerGoal") },
      sf:       { win: dollars("sf_win"), gdPerGoalWc: dollars("sf_gdPerGoalWc"), gdPerGoalEuros: dollars("sf_gdPerGoalEuros") },
      third:    { win: dollars("third_win"), gdPerGoal: dollars("third_gdPerGoal") },
      final:    { winnerBase: dollars("final_winnerBase"), runnerUpBase: dollars("final_runnerUpBase"), goalsMultiplier: dollars("final_goalsMultiplier") },
      oddsJump:   { jump2: dollars("oddsJump_jump2"), jump3plus: dollars("oddsJump_jump3plus") },
      bonuses:    scoringConfig.bonuses,
      buyInCents: dollars("buyInCents"),
      prizeTiers: scoringConfig.prizeTiers,
    };

    await prisma.scoringConfig.upsert({
      where: { tournamentId: activeTournament.id },
      create: { tournamentId: activeTournament.id, config },
      update: { config },
    });
    await prisma.adminAuditLog.create({
      data: { adminId, action: "UPDATE_SCORING_CONFIG", target: activeTournament.id, changes: config },
    });
    redirect("/admin?msg=Scoring+rules+saved");
  }

  async function addAdjustmentAction(formData: FormData) {
    "use server";
    const adminId = await requireAdmin();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const uid = String(formData.get("userId") ?? "").trim();
    const amountStr = String(formData.get("amount") ?? "0").trim();
    const reason = String(formData.get("reason") ?? "").trim() || "Manual adjustment";
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    if (!tournamentId || !uid || !Number.isFinite(amountCents)) redirect("/admin?error=Invalid+fields");
    await prisma.earningsAdjustment.create({ data: { tournamentId, userId: uid, amountCents, reason } });
    await prisma.adminAuditLog.create({ data: { adminId, action: "ADD_EARNINGS_ADJUSTMENT", target: uid, changes: { tournamentId, amountCents, reason } } });
    redirect("/admin?msg=Adjustment+added");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-extrabold text-zinc-900">Admin Panel</h1>

      {resolved.msg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {resolved.msg}
        </div>
      )}
      {resolved.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      )}

      {/* ── Create Tournament ── */}
      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">Create Tournament</h2>
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const thisYear = today.getFullYear();
          const available = TOURNAMENT_PRESETS.filter(
            (p) => p.year === thisYear && new Date(p.startDate) > today,
          );
          if (available.length === 0) {
            return (
              <p className="text-sm text-zinc-500">No upcoming tournaments available.</p>
            );
          }
          return (
            <form action={createTournamentAction} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-500">Tournament</span>
                <select name="preset" required
                  className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-500">
                  {available.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-500">Pool name (optional)</span>
                <input name="poolName" type="text" placeholder="e.g. Chris's WC2026 Pool" maxLength={80}
                  className="h-10 w-56 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-500 placeholder:text-zinc-400" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-zinc-500">Teams per player</span>
                <input name="teamsPerPlayer" type="number" defaultValue={4} min={1} max={20}
                  className="h-10 w-28 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-emerald-500" />
              </label>
              <button type="submit" className="h-10 self-end rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
                Create
              </button>
          </form>
          );
        })()}
      </section>

      {/* ── Tournaments List ── */}
      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">Tournaments</h2>
        <div className="space-y-2">
          {tournaments.map((t) => (
            <div key={t.id} className="rounded-xl bg-zinc-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-zinc-900">{t.poolName ?? `${t.name} ${t.year}`}</span>
                  {t.poolName && <span className="ml-2 text-xs text-zinc-500">{t.name} {t.year}</span>}
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 capitalize">{t.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                  t.status === "active" ? "bg-emerald-100 text-emerald-700" :
                  t.status === "draft" ? "bg-amber-100 text-amber-700" :
                  t.status === "complete" ? "bg-sky-100 text-sky-700" :
                  "bg-zinc-100 text-zinc-500"
                }`}>{t.status}</span>
                <form action={setTournamentStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <select name="status" defaultValue={t.status}
                    className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 outline-none">
                    <option value="upcoming">upcoming</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="complete">complete</option>
                  </select>
                  <button type="submit" className="h-8 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200">Set</button>
                </form>
              </div>
              {t.inviteToken && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Invite link:</span>
                  <code className="truncate text-xs text-zinc-600">{baseUrl}/join/{t.inviteToken}</code>
                  <CopyButton value={`${baseUrl}/join/${t.inviteToken}`} label="Copy" />
                </div>
              )}
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-zinc-500 text-sm">No tournaments yet.</p>}
        </div>
      </section>

      {activeTournament && (
        <>
          {/* ── Match Results (override) ── */}
          <section className="mb-8 rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <details>
              <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-6 py-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Override Match Results</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">Results sync automatically — use this to correct API errors only.</p>
                </div>
                <span className="text-xs font-medium text-zinc-400 group-open:hidden">[expand]</span>
              </summary>
              <div className="border-t border-zinc-100 px-6 pb-6 pt-4 space-y-2">
                {matches.map((m) => {
                  const home = TEAMS_BY_CODE.get(m.homeTeam);
                  const away = TEAMS_BY_CODE.get(m.awayTeam);
                  return (
                    <div key={m.id} className="rounded-xl bg-zinc-50 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-600 uppercase">{m.stage}</span>
                        {m.groupName && <span>Group {m.groupName}</span>}
                        {m.played && <span className="text-emerald-600">✓ played</span>}
                      </div>
                      <form action={updateMatchResultAction} className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="hidden" name="id" value={m.id} />
                        <span className="font-semibold text-zinc-900 min-w-[6rem]">{home?.name ?? m.homeTeam}</span>
                        <input type="number" name="homeScore" min={0} max={30} defaultValue={m.homeScore ?? 0}
                          className="h-8 w-14 rounded-lg border border-zinc-300 bg-white text-center text-sm text-zinc-900 outline-none" />
                        <span className="text-zinc-500">–</span>
                        <input type="number" name="awayScore" min={0} max={30} defaultValue={m.awayScore ?? 0}
                          className="h-8 w-14 rounded-lg border border-zinc-300 bg-white text-center text-sm text-zinc-900 outline-none" />
                        <span className="font-semibold text-zinc-900 min-w-[6rem]">{away?.name ?? m.awayTeam}</span>
                        <select name="penaltyWinner" defaultValue={m.penaltyWinner ?? ""}
                          className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 outline-none">
                          <option value="">No pens</option>
                          <option value={m.homeTeam}>{home?.name ?? m.homeTeam} wins pens</option>
                          <option value={m.awayTeam}>{away?.name ?? m.awayTeam} wins pens</option>
                        </select>
                        <button type="submit" className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700">Save</button>
                      </form>
                    </div>
                  );
                })}
                {matches.length === 0 && <p className="text-zinc-500 text-sm">No matches synced yet.</p>}
              </div>
            </details>
          </section>

          {/* ── Scoring Rules ── */}
          <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
              Scoring Rules — {activeTournament.name} {activeTournament.year}
            </h2>
            <ScoringConfigEditor config={scoringConfig} saveAction={saveScoringConfigAction} />
          </section>

          {/* ── Earnings Adjustment ── */}
          <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">Manual Earnings Adjustment</h2>
            <form action={addAdjustmentAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="tournamentId" value={activeTournament.id} />
              <select name="userId" className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
              <input name="amount" type="number" step="0.01" placeholder="Amount $" 
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
              <input name="reason" placeholder="Reason (e.g. odds jump bonus)"
                className="h-10 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400" />
              <button type="submit" className="h-10 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600">
                Add Adjustment
              </button>
            </form>
          </section>
        </>
      )}

      {/* ── Users / Admins ── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">Users</h2>
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-2 text-sm">
              <span className="flex-1 text-zinc-900">{u.name ?? u.email}</span>
              <span className="text-xs text-zinc-500">{u.email}</span>
              {u.isAdmin && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">admin</span>}
              <form action={toggleAdminAction}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="currentAdmin" value={String(u.isAdmin)} />
                <button type="submit" className="h-7 rounded-lg bg-zinc-100 px-3 text-xs text-zinc-700 hover:bg-zinc-200">
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
