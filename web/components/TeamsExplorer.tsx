"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { formatDollars } from "@/lib/earnings";

export type TeamsExplorerTeam = {
  code: string;
  name: string;
  rank: number;
  group: string;
  tier: number;
  tierLabel: string;
  ownerName: string | null;
  ownerUserId: string | null;
  ownerColorIdx: number | null;
  earningsCents: number;
  /** Number of group stage upset wins (jump bonuses earned) */
  jumpBonusCount: number;
  /** Highest knockout round reached */
  highestStage: string | null;
  /** Whether the team is still active (not eliminated) */
  active: boolean;
  /** Matches played */
  matchesPlayed: number;
  /** Wins */
  wins: number;
  /** Draws */
  draws: number;
  /** Goals scored */
  goalsFor: number;
};

type SortKey = "rank" | "earnings" | "jumps" | "name" | "tier";
type Filter = "all" | "active" | "eliminated" | "jumped" | "unowned";

const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "3rd", "final"];
const STAGE_LABELS: Record<string, string> = {
  group: "Group", r32: "R32", r16: "R16", qf: "QF", sf: "SF", "3rd": "3rd Place", final: "Final",
};
const TIER_LABELS = ["", "Contenders", "Dark horses", "Mid pack", "Long shots"];

interface Props {
  teams: TeamsExplorerTeam[];
}

export default function TeamsExplorer({ teams }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [tierFilter, setTierFilter] = useState<number>(0); // 0 = all
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const gs = [...new Set(teams.map((t) => t.group))].sort();
    return gs;
  }, [teams]);

  const filtered = useMemo(() => {
    let result = [...teams];

    // Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.ownerName?.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filter === "active") result = result.filter((t) => t.active);
    else if (filter === "eliminated") result = result.filter((t) => !t.active);
    else if (filter === "jumped") result = result.filter((t) => t.jumpBonusCount > 0);
    else if (filter === "unowned") result = result.filter((t) => !t.ownerName);

    // Tier filter
    if (tierFilter > 0) result = result.filter((t) => t.tier === tierFilter);

    // Group filter
    if (groupFilter !== "all") result = result.filter((t) => t.group === groupFilter);

    // Sort
    result.sort((a, b) => {
      if (sortBy === "earnings") return b.earningsCents - a.earningsCents;
      if (sortBy === "jumps") return b.jumpBonusCount - a.jumpBonusCount || a.rank - b.rank;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "tier") return a.tier - b.tier || a.rank - b.rank;
      return a.rank - b.rank; // default: rank
    });

    return result;
  }, [teams, filter, sortBy, tierFilter, groupFilter, search]);

  const jumpedCount = teams.filter((t) => t.jumpBonusCount > 0).length;
  const activeCount = teams.filter((t) => t.active).length;

  return (
    <section style={{ marginTop: 32 }}>
      <div className="sec-head" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20 }}>All Teams</h2>
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          {activeCount} active · {jumpedCount} with jump bonus{jumpedCount !== 1 ? "es" : ""}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {/* Status filters */}
        <div className="seg">
          {(["all", "active", "eliminated", "jumped", "unowned"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "on" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" :
               f === "active" ? `Active (${activeCount})` :
               f === "eliminated" ? "Elim'd" :
               f === "jumped" ? `Jump bonus (${jumpedCount})` :
               "Unowned"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {/* Tier filter */}
        <div className="seg">
          <button type="button" className={tierFilter === 0 ? "on" : ""} onClick={() => setTierFilter(0)}>All tiers</button>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" className={tierFilter === n ? "on" : ""} onClick={() => setTierFilter(n)}>
              T{n}
            </button>
          ))}
        </div>

        {/* Group filter */}
        <div className="seg">
          <button type="button" className={groupFilter === "all" ? "on" : ""} onClick={() => setGroupFilter("all")}>All groups</button>
          {groups.map((g) => (
            <button key={g} type="button" className={groupFilter === g ? "on" : ""} onClick={() => setGroupFilter(g)}>
              {g}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{
            height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--line)",
            background: "var(--surface)", color: "var(--ink)", fontSize: 13,
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          <option value="rank">Sort: FIFA rank</option>
          <option value="earnings">Sort: Earnings</option>
          <option value="jumps">Sort: Jump bonuses</option>
          <option value="tier">Sort: Tier</option>
          <option value="name">Sort: Name</option>
        </select>

        {/* Search */}
        <div className="draft-search" style={{ flex: "1 1 180px", maxWidth: 260 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
          </svg>
          <input
            type="search"
            placeholder="Search team or owner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", background: "transparent", outline: "none", fontFamily: "inherit", fontSize: 14, color: "var(--ink)", flex: 1, minWidth: 0 }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card tbl-scroll">
        <table className="tbl" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th className="flag-cell">Flag</th>
              <th>Team</th>
              <th>Tier</th>
              <th>Group</th>
              <th>Owner</th>
              <th className="r">Matches</th>
              <th className="r">Jumps</th>
              <th className="r">Stage</th>
              <th className="r">Earned</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.code} style={{ opacity: !t.active && t.matchesPlayed > 0 ? 0.6 : 1 }}>
                <td className="flag-cell">
                  <CountryFlag code={t.code} label={t.name} className="flag-lg fi-rect" />
                </td>
                <td className="nm-cell">
                  <span className="nm-name-row" style={{ fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>FIFA #{t.rank}</span>
                </td>
                <td>
                  <span className={`tier tier-${t.tier}`}>{t.tierLabel}</span>
                </td>
                <td>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Grp {t.group}</span>
                </td>
                <td>
                  {t.ownerName && t.ownerUserId ? (
                    <Link href={`/standings/player/${t.ownerUserId}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <span className={`m-chip m${t.ownerColorIdx ?? 0}`}>
                        <span className="mdot" />
                        <span className="chip-lbl">{t.ownerName}</span>
                      </span>
                    </Link>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Unowned</span>
                  )}
                </td>
                <td className="r mono" style={{ fontSize: 13 }}>
                  {t.matchesPlayed > 0 ? `${t.wins}W ${t.draws}D` : "—"}
                </td>
                <td className="r">
                  {t.jumpBonusCount > 0 ? (
                    <span style={{ fontWeight: 800, color: "var(--grass-deep)", fontSize: 13 }}>
                      🔥 ×{t.jumpBonusCount}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-faint)", fontSize: 13 }}>—</span>
                  )}
                </td>
                <td className="r">
                  {t.highestStage ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.active ? "var(--grass-deep)" : "var(--ink-faint)" }}>
                      {STAGE_LABELS[t.highestStage] ?? t.highestStage}
                      {t.active && " 🟢"}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
                  )}
                </td>
                <td className="r">
                  <span className={`money${t.earningsCents > 0 ? " pos" : ""}`} style={{ fontSize: 14 }}>
                    {t.earningsCents > 0 ? formatDollars(t.earningsCents) : "—"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "var(--ink-faint)" }}>
                  No teams match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: "var(--ink-faint)" }}>
        <span>🔥 Jump bonus = group stage upset win vs higher-ranked tier</span>
        <span>🟢 = still active in tournament</span>
        {[1, 2, 3, 4].map((n) => (
          <span key={n}><span className={`tier tier-${n}`}>{TIER_LABELS[n]}</span></span>
        ))}
      </div>
    </section>
  );
}
