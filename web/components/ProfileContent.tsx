"use client";

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";

import { CountryFlag } from "@/components/CountryFlag";
import { CountdownTimer } from "@/components/CountdownTimer";
import { formatDollars } from "@/lib/earnings";
import { getTeamPlayers, POSITION_COLOR } from "@/lib/players";
import { TEAMS } from "@/lib/teams";

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

const STAGE_LABELS: Record<string, string> = {
  group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd", final: "Final",
};

export interface ProfileMatchItem {
  stage: string;
  oppCode: string;
  myScore: number;
  oppScore: number;
  earnedCents: number;
  isWin: boolean;
  isDraw: boolean;
  matchDate: Date | null;
  venue: string | null;
}

export interface ProfileTeam {
  teamCode: string;
  earnedCents: number;
  matchBreakdown: ProfileMatchItem[];
}

export interface ProfileContentProps {
  upcomingTournament: {
    id: string; name: string; year: number; status: string;
    draftDate: Date | null; teamsPerPlayer: number;
  } | null;
  activeTournamentName: string | null;
  totalEarnedCents: number;
  teams: ProfileTeam[];
  history: { id: string; name: string; year: number; teamCodes: string[] }[];
  draftHref?: string;
  disableTournamentLinks?: boolean;
  userName?: string | null;
  upcomingTeamName?: string | null;
  upcomingTournamentId?: string | null;
}

function fmtPST(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    hour12: true, timeZoneName: "short",
  });
}

function DarkModeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("wc_theme", next ? "dark" : "light"); } catch { /* noop */ }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`sw-track${dark ? "" : " off"}`}
    />
  );
}

export default function ProfileContent({
  upcomingTournament,
  activeTournamentName,
  totalEarnedCents,
  teams,
  history,
  draftHref = "/draft",
  disableTournamentLinks = false,
  userName: initialUserName = null,
  upcomingTeamName: initialTeamName = null,
  upcomingTournamentId = null,
}: ProfileContentProps) {
  const [name, setName] = useState(initialUserName ?? "");
  const [teamName, setTeamName] = useState(initialTeamName ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...(upcomingTournamentId ? { tournamentId: upcomingTournamentId, teamName } : {}),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const initials = (name || initialUserName || "?")[0]?.toUpperCase() ?? "?";
  const totalTournaments = history.length + (activeTournamentName ? 1 : 0) + (upcomingTournament && !activeTournamentName ? 1 : 0);
  const totalTeams = history.reduce((s, h) => s + h.teamCodes.length, 0) + teams.length;
  const activeTournLabel = activeTournamentName ?? (upcomingTournament ? `${upcomingTournament.name} ${upcomingTournament.year}` : "Manager");

  return (
    <main className="page">
      <div className="wrap">

        {/* â”€â”€ Profile header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="prof-head">
          <div className="prof-av">{initials}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="kicker grass">{activeTournLabel}</div>
            <h1 style={{ marginTop: 4, fontSize: "clamp(28px,4vw,36px)" }}>{name || initialUserName || "Your Profile"}</h1>
          </div>
        </div>

        {/* â”€â”€ Two-column layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="prof-grid">

          {/* Left column */}
          <div style={{ display: "grid", gap: 22 }}>

            {/* Stats */}
            <div className="stats4">
              <div className="card st">
                <div className="k">Tournaments</div>
                <div className="v">{totalTournaments || <>&mdash;</>}</div>
              </div>
              <div className="card st">
                <div className="k">Earned</div>
                <div className="v money pos">{formatDollars(totalEarnedCents)}</div>
              </div>
              <div className="card st">
                <div className="k">Teams now</div>
                <div className="v">{teams.length || <>&mdash;</>}</div>
              </div>
              <div className="card st">
                <div className="k">All-time picks</div>
                <div className="v">{totalTeams || <>&mdash;</>}</div>
              </div>
            </div>

            {/* Upcoming tournament */}
            {upcomingTournament && (
              <section className="card card-pad">
                <div className="kicker" style={{ marginBottom: 6 }}>
                  {upcomingTournament.status === "draft" ? "Draft open" : "Invited"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{upcomingTournament.name} {upcomingTournament.year}</div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{upcomingTournament.teamsPerPlayer} teams per player &middot; snake draft</div>
                  </div>
                  <Link href={draftHref} className="btn btn-primary btn-sm" style={{ height: 36, fontSize: 13 }}>
                    Open Draft &rarr;
                  </Link>
                </div>
                {upcomingTournament.draftDate && (
                  <div style={{ marginTop: 14 }}>
                    <CountdownTimer
                      targetISO={upcomingTournament.draftDate.toISOString()}
                      label={`${upcomingTournament.name} ${upcomingTournament.year} Draft`}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Active tournament teams */}
            {activeTournamentName && teams.length > 0 && (
              <section>
                <div className="sec-head" style={{ marginBottom: 14 }}>
                  <h2 style={{ fontSize: 19 }}>{activeTournamentName}</h2>
                  <div className="money pos" style={{ fontSize: 15 }}>{formatDollars(totalEarnedCents)}</div>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  {teams.map((team) => {
                    const teamData = TEAMS_BY_CODE.get(team.teamCode);
                    const players = getTeamPlayers(team.teamCode);
                    return (
                      <div key={team.teamCode} className="card" style={{ overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                          <CountryFlag code={team.teamCode} label={teamData?.name ?? team.teamCode} className="flag-lg fi-rect" />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{teamData?.name ?? team.teamCode}</div>
                            <div className="tag-soft">FIFA #{teamData?.rank} &middot; Group {teamData?.group}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="tag-soft">earned</div>
                            <div className={`money${team.earnedCents > 0 ? " pos" : ""}`} style={{ fontSize: 18 }}>
                              {formatDollars(team.earnedCents)}
                            </div>
                          </div>
                        </div>
                        {players.length > 0 && (
                          <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8, borderBottom: "1px solid var(--line-soft)", background: "var(--surface-2)" }}>
                            {players.map((p) => (
                              <span key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)" }}>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${POSITION_COLOR[p.position]}`}>{p.position}</span>
                                {p.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {team.matchBreakdown.length > 0 ? (
                          <div>
                            {team.matchBreakdown.map((match, i) => {
                              const opp = TEAMS_BY_CODE.get(match.oppCode);
                              return (
                                <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ width: 48, fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                    {STAGE_LABELS[match.stage] ?? match.stage}
                                  </span>
                                  <CountryFlag code={match.oppCode} label={opp?.name ?? match.oppCode} className="flag-sm fi-rect" />
                                  <span style={{ flex: 1, fontSize: 13, color: "var(--ink-soft)" }}>vs {opp?.name ?? match.oppCode}</span>
                                  <span className={`finish${match.isWin ? " pod" : match.isDraw ? " mid" : " mid"}`}>
                                    {match.myScore}â€“{match.oppScore}
                                  </span>
                                  <span className={`money${match.earnedCents > 0 ? " pos" : ""}`} style={{ fontSize: 13, minWidth: 52, textAlign: "right" }}>
                                    {match.earnedCents > 0 ? `+${formatDollars(match.earnedCents)}` : "â€”"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ padding: "10px 16px", fontSize: 13, color: "var(--ink-faint)" }}>No matches played yet</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Tournament history */}
            {history.length > 0 && (
              <section className="card" style={{ padding: "8px 16px" }}>
                <div className="sec-head" style={{ margin: "12px 0 8px" }}>
                  <h2 style={{ fontSize: 19 }}>Tournament history</h2>
                </div>
                {history.map((t) => {
                  const inner = (
                    <>
                      <span className="yr">{t.year}</span>
                      <div className="nm">{t.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="finish mid">{t.teamCodes.length} picks</span>
                      </div>
                    </>
                  );
                  return disableTournamentLinks ? (
                    <div key={t.id} className="hist-row">{inner}</div>
                  ) : (
                    <Link key={t.id} href={`/profile/tournament/${t.id}`} className="hist-row" style={{ textDecoration: "none", color: "inherit" }}>
                      {inner}
                    </Link>
                  );
                })}
              </section>
            )}
          </div>

          {/* Right column â€” settings sidebar */}
          <aside style={{ display: "grid", gap: 18 }}>
            <section className="card card-pad">
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>Settings</h2>

              {saved && (
                <div className="badge grass" style={{ marginBottom: 10, height: "auto", padding: "6px 12px", borderRadius: 10 }}>
                  Saved âœ“
                </div>
              )}

              <div className="setrow">
                <div>
                  <div className="lbl">Dark mode</div>
                  <div className="sub">Match your system</div>
                </div>
                <DarkModeToggle />
              </div>

              <div className="setrow" style={{ paddingTop: 16, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="lbl">Display name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={64}
                    style={{
                      height: 38, borderRadius: 10, border: "1px solid var(--line)",
                      background: "var(--surface-2)", color: "var(--ink)", padding: "0 12px",
                      fontSize: 14, outline: "none",
                    }}
                  />
                </label>
                {upcomingTournamentId && (
                  <label style={{ display: "grid", gap: 4 }}>
                    <span className="lbl">Team name</span>
                    <input
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      maxLength={64}
                      placeholder="e.g. The Underdogs FC"
                      style={{
                        height: 38, borderRadius: 10, border: "1px solid var(--line)",
                        background: "var(--surface-2)", color: "var(--ink)", padding: "0 12px",
                        fontSize: 14, outline: "none",
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="btn btn-primary"
                  style={{ height: 38, fontSize: 13, alignSelf: "flex-start" }}
                >
                  {isPending ? "Savingâ€¦" : "Save changes"}
                </button>
              </div>
            </section>
          </aside>

        </div>
      </div>
    </main>
  );
}
