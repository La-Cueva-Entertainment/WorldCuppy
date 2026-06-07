"use client";

import { useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";

interface TierData {
  key: string;
  num: number;
  labelBase: string;
  label: string;
  jump: string;
  rangeLabel: string;
  teams: { code: string; name: string; rank: number }[];
}

interface RecentPick {
  pickNumber: number;
  teamCode: string;
  teamName: string;
  pickerName: string;
  colorIdx: number;
}

interface Props {
  tiers: TierData[];
  takenTeamCodes: string[];
  myTeamCodes: string[];
  takenBy: Record<string, { label: string; colorIndex: number }>;
  canDraft: boolean;
  canPickNow: boolean;
  picksCount: number;
  lineupSize: number;
  draftTeamAction: (formData: FormData) => Promise<void>;
  extraFormFields?: React.ReactNode;
  initialTierKey?: string;
  recentPicks: RecentPick[];
}

export default function DraftTeamTable({
  tiers,
  takenTeamCodes,
  myTeamCodes,
  takenBy,
  canDraft,
  canPickNow,
  picksCount,
  lineupSize,
  draftTeamAction,
  extraFormFields,
  initialTierKey,
  recentPicks,
}: Props) {
  const [tierFilter, setTierFilter] = useState(initialTierKey ?? "all");
  const [search, setSearch] = useState("");

  const takenSet = new Set(takenTeamCodes);
  const mySet = new Set(myTeamCodes);

  const allTeams = tiers.flatMap((t) =>
    t.teams.map((tm) => ({ ...tm, tierKey: t.key, tierNum: t.num, tierLabel: t.labelBase, tierJump: t.jump, rangeLabel: t.rangeLabel }))
  );

  const filtered = allTeams.filter((tm) => {
    if (tierFilter !== "all" && tm.tierKey !== tierFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return tm.name.toLowerCase().includes(q) || tm.code.toLowerCase().includes(q);
    }
    return true;
  });

  const canPick = canPickNow && picksCount < lineupSize;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div className="seg">
          <button className={tierFilter === "all" ? "on" : ""} onClick={() => setTierFilter("all")} type="button">All</button>
          {tiers.map((t) => (
            <button key={t.key} className={tierFilter === t.key ? "on" : ""} onClick={() => setTierFilter(t.key)} type="button">
              {t.labelBase}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px",
          border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface)", color: "var(--ink-faint)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
          </svg>
          <input
            type="search"
            placeholder="Find a team"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", background: "transparent", outline: "none",
              fontFamily: "inherit", fontSize: 14, color: "var(--ink)", width: 120 }}
          />
        </div>
      </div>

      {canDraft && (
        <p className="tag-soft" style={{ margin: "-4px 0 14px", fontWeight: 600 }}>
          Order is <strong>randomized</strong> — no rank advantage. Tier sets the jump payout.
        </p>
      )}

      {/* Team table */}
      <div className="card tbl-scroll" style={{ padding: "4px 6px" }}>
        <table className="tbl teamtbl" style={{ width: "100%", minWidth: 460 }}>
          <thead>
            <tr>
              <th style={{ width: 46 }}>Flag</th>
              <th>Team</th>
              <th>Tier · payout</th>
              <th className="r rk" style={{ width: 54 }}>FIFA</th>
              {canDraft && <th className="r act">Pick</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tm) => {
              const taken = takenSet.has(tm.code);
              const mine = mySet.has(tm.code);
              const who = takenBy[tm.code];
              return (
                <tr key={tm.code} className={[taken && !mine ? "taken" : "", mine ? "mine" : ""].filter(Boolean).join(" ")}>
                  <td className="flag-cell">
                    <CountryFlag code={tm.code} label={tm.name} className="flag-lg fi-rect" />
                  </td>
                  <td className="nm-cell">{tm.name}</td>
                  <td className="tier-cell">
                    <span className={`tier tier-${tm.tierNum}`}>{tm.tierLabel}</span>
                  </td>
                  <td className="r rk">#{tm.rank}</td>
                  {canDraft && (
                    <td className="act">
                      {taken ? (
                        who ? (
                          <span className={`m-chip m${who.colorIndex % 8}`}>
                            <span className="mdot" />{who.label}
                          </span>
                        ) : (
                          <span className="tag-soft">taken</span>
                        )
                      ) : (
                        <form action={draftTeamAction}>
                          {extraFormFields}
                          <input type="hidden" name="teamCode" value={tm.code} />
                          <input type="hidden" name="tier" value={tierFilter !== "all" ? tierFilter : ""} />
                          <button type="submit" className="draftbtn" disabled={!canPick}>Draft</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canDraft ? 5 : 4} style={{ textAlign: "center", padding: 24, color: "var(--ink-faint)" }}>
                  No teams match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* How tiers pay legend */}
      <div className="sec-head" style={{ margin: "26px 0 12px" }}>
        <h2 style={{ fontSize: 19 }}>How tiers pay — &ldquo;jumps&rdquo;</h2>
      </div>
      <div className="legend">
        {tiers.map((t) => (
          <div key={t.key} className="l">
            <span className={`tier tier-${t.num}`}>{t.labelBase}</span>
            <div className="muted">{t.rangeLabel}</div>
            <div className={`jp${t.num > 1 ? " pos" : ""}`}>{t.jump}</div>
          </div>
        ))}
      </div>
      <p className="tag-soft" style={{ marginTop: 10 }}>
        A <strong>jump</strong> = your team beating a higher-tier team in the knockouts.
        Lower-tier upsets pay more, so a smart long-shot pick can win you the pool.
      </p>

      {/* Recent picks ticker */}
      {recentPicks.length > 0 && (
        <>
          <div className="sec-head" style={{ margin: "26px 0 12px" }}>
            <h2 style={{ fontSize: 19 }}>Recent picks</h2>
          </div>
          <div className="ticker">
            {[...recentPicks].reverse().map((rp) => (
              <div key={`${rp.pickNumber}-${rp.teamCode}`} className={`tk m${rp.colorIdx % 8}`}>
                <span className="pk">#{rp.pickNumber}</span>
                <CountryFlag code={rp.teamCode} label={rp.teamName} className="flag-md fi-rect" />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{rp.teamName}</span>
                <span className="by">{rp.pickerName}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
