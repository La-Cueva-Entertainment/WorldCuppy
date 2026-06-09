import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDraftAnalysis } from "@/lib/draftAnalysis";
import { isSiteOwner } from "@/lib/siteOwner";
import { TEAMS } from "@/lib/teams";
import { CountryFlag } from "@/components/CountryFlag";

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40",
  "A":  "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40",
  "A-": "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40",
  "B+": "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40",
  "B":  "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40",
  "B-": "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40",
  "C+": "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40",
  "C":  "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40",
  "C-": "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40",
  "D+": "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40",
  "D":  "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40",
  "D-": "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/40",
  "F":  "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40",
};

const TIER_LABELS = ["", "Contender", "Dark Horse", "Mid Pack", "Long Shot"];
const TIER_PILL: Record<number, string> = {
  1: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  2: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300",
  3: "bg-zinc-100 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300",
  4: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300",
};

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

export default async function DraftAnalysisPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let userId: string | undefined = session.user.id;
  if (!userId) {
    const email = session.user.email?.toLowerCase().trim();
    if (email) {
      const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = u?.id;
    }
  }
  if (!userId) redirect("/login");

  const isAdmin =
    isSiteOwner(session) ||
    !!(await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }))?.isAdmin;

  // Find the most recent completed or active draft
  const draftRecord = await prisma.tournamentDraft.findFirst({
    where: { status: { in: ["complete", "active"] } },
    orderBy: { updatedAt: "desc" },
    select: { tournamentId: true, status: true, analysis: true },
  });

  const tournament = draftRecord
    ? await prisma.tournament.findUnique({
        where: { id: draftRecord.tournamentId },
        select: { id: true, name: true, year: true },
      })
    : null;

  // ── No draft yet ──
  if (!draftRecord || !tournament) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <div className="text-5xl mb-4">📋</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">No draft yet</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">The draft analysis will appear here once a draft has been completed.</p>
        <Link href="/draft" className="mt-4 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Back to Draft →</Link>
      </main>
    );
  }

  const analysis = draftRecord.analysis
    ? (draftRecord.analysis as Awaited<ReturnType<typeof getDraftAnalysis>>)
    : null;

  // ── Analysis pending (draft complete but AI hasn't finished) ──
  if (!analysis) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <div className="text-5xl mb-4">🤖</div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Analysis incoming…</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Claude is reading the picks and preparing to brutally judge everyone. Check back in a minute.
        </p>
        {isAdmin && (
          <form method="POST" action={`/api/draft-analysis/${draftRecord.tournamentId}`} className="mt-6 inline-block">
            <button type="submit" className="btn btn-primary btn-sm">Force Regenerate</button>
          </form>
        )}
        <Link href="/draft" className="mt-4 inline-block text-sm text-emerald-600 dark:text-emerald-400 hover:underline">Back to Draft →</Link>
      </main>
    );
  }

  const mvpPlayer = analysis.players.find((p) => p.userId === analysis.draftMVP);
  const goatPlayer = analysis.players.find((p) => p.userId === analysis.draftGoat);
  const generatedDate = new Date(analysis.generatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-8">
      {/* ── Header ── */}
      <div className="text-center space-y-2">
        <div className="text-4xl">🏆</div>
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          {tournament.name} {tournament.year}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">AI Draft Report Card</p>
        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 italic mt-1">&ldquo;{analysis.headline}&rdquo;</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600">Generated {generatedDate} · Powered by Claude AI</p>
      </div>

      {/* ── MVP / GOAT callout ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
          <div className="text-2xl mb-1">👑</div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Draft MVP</p>
          <p className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">{mvpPlayer?.name ?? analysis.draftMVPName}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Won the draft room</p>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-center">
          <div className="text-2xl mb-1">🐐</div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500 dark:text-red-400">Draft GOAT</p>
          <p className="text-lg font-extrabold text-zinc-900 dark:text-white mt-0.5">{goatPlayer?.name ?? analysis.draftGoatName}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Greatest Of All-Time (at losing)</p>
        </div>
      </div>

      {/* ── Storyline ── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/50 p-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <span>📖</span> The Draft Storyline
        </h2>
        {analysis.storyline.split(/\n\n+/).map((para, i) => (
          <p key={i} className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{para}</p>
        ))}
      </div>

      {/* ── Player cards ── */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Report Cards</h2>
        {analysis.players.map((player) => {
          const gradeClass = GRADE_COLORS[player.grade] ?? GRADE_COLORS["C"]!;
          const isMVP = player.userId === analysis.draftMVP;
          const isGoat = player.userId === analysis.draftGoat;
          return (
            <div
              key={player.userId}
              className={`rounded-2xl border bg-white dark:bg-zinc-800/50 overflow-hidden ${
                isMVP ? "border-emerald-300 dark:border-emerald-500/40" :
                isGoat ? "border-red-300 dark:border-red-500/40" :
                "border-zinc-200 dark:border-zinc-700/60"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-700/60">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-zinc-900 dark:text-white text-lg leading-tight">
                      {player.name}
                      {isMVP && <span className="ml-2 text-emerald-500 text-sm">👑 MVP</span>}
                      {isGoat && <span className="ml-2 text-red-500 text-sm">🐐 GOAT</span>}
                    </span>
                  </div>
                </div>
                <div className={`rounded-xl border px-4 py-1.5 text-2xl font-black leading-none ${gradeClass}`}>
                  {player.grade}
                </div>
              </div>

              {/* Summary */}
              <div className="px-5 py-3 space-y-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{player.summary}</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-0.5">✅ Strengths</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{player.strengths}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-0.5">⚠️ Weaknesses</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{player.weaknesses}</p>
                  </div>
                </div>
              </div>

              {/* Picks */}
              {player.picks && player.picks.length > 0 && (
                <div className="px-5 pb-4">
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/60">
                    {player.picks.map((pick) => {
                      const teamData = TEAMS_BY_CODE.get(pick.teamCode);
                      return (
                        <div
                          key={pick.teamCode}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600/60 px-2.5 py-1.5"
                        >
                          <CountryFlag code={pick.teamCode} label={pick.teamName} className="w-4 h-4" />
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                            {teamData?.name ?? pick.teamName}
                          </span>
                          <span className={`text-[10px] font-bold rounded px-1 py-0.5 ${TIER_PILL[pick.tier] ?? TIER_PILL[4]}`}>
                            T{pick.tier}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Grp {pick.group}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Admin regen ── */}
      {isAdmin && (
        <div className="text-center pt-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mb-2">Admin — regenerate if picks changed</p>
          <RegenButton tournamentId={draftRecord.tournamentId} />
        </div>
      )}

      <div className="text-center pb-8">
        <Link href="/draft" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">← Back to Draft</Link>
      </div>
    </main>
  );
}

function RegenButton({ tournamentId }: { tournamentId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        const { generateDraftAnalysis } = await import("@/lib/draftAnalysis");
        await generateDraftAnalysis(tournamentId);
        const { redirect: nav } = await import("next/navigation");
        nav("/draft/analysis");
      }}
    >
      <button type="submit" className="btn btn-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        🔄 Regenerate Analysis
      </button>
    </form>
  );
}
