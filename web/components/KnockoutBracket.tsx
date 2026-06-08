import { CountryFlag } from "@/components/CountryFlag";
import type { TvMatch } from "@/components/TournamentView";

const BRACKET_STAGES = ["r32", "r16", "qf", "sf", "final"] as const;
const BRACKET_LABELS: Record<string, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-Finals",
  sf: "Semi-Finals",
  final: "Final",
};

// How to space columns so the bracket looks aligned
const COL_CLASS: Record<string, string> = {
  r32: "",
  r16: "",
  qf: "br-qf",
  sf: "br-center",
  final: "br-center",
};

function BrMatch({ m }: { m: TvMatch }) {
  const homeWon = m.played && ((m.homeScore ?? 0) > (m.awayScore ?? 0) || m.penaltyWinner === m.homeTeam);
  const awayWon = m.played && ((m.awayScore ?? 0) > (m.homeScore ?? 0) || m.penaltyWinner === m.awayTeam);

  return (
    <div className={`br-match${!m.played ? " br-future" : ""}`}>
      <div className={`br-team${homeWon ? " win" : m.played ? " lose" : ""}`}>
        <CountryFlag code={m.homeTeam} label={m.homeTeamName} className="flag-sm fi-rect" />
        <span className="nm">{m.homeTeamName}</span>
        {m.homeOwnerColorIdx != null && (
          <span className={`br-owner m${m.homeOwnerColorIdx % 8}`} />
        )}
        {m.played && (
          <span className="sc">
            {m.homeScore}
            {m.penaltyWinner === m.homeTeam && <span className="tag-soft" style={{ fontSize: 10, marginLeft: 2 }}>p</span>}
          </span>
        )}
      </div>
      <div className="br-mid" />
      <div className={`br-team${awayWon ? " win" : m.played ? " lose" : ""}`}>
        <CountryFlag code={m.awayTeam} label={m.awayTeamName} className="flag-sm fi-rect" />
        <span className="nm">{m.awayTeamName}</span>
        {m.awayOwnerColorIdx != null && (
          <span className={`br-owner m${m.awayOwnerColorIdx % 8}`} />
        )}
        {m.played && (
          <span className="sc">
            {m.awayScore}
            {m.penaltyWinner === m.awayTeam && <span className="tag-soft" style={{ fontSize: 10, marginLeft: 2 }}>p</span>}
          </span>
        )}
      </div>
    </div>
  );
}

export function KnockoutBracket({
  matchesByStage,
}: {
  matchesByStage: Partial<Record<string, TvMatch[]>>;
}) {
  const stagesWithMatches = BRACKET_STAGES.filter(
    (s) => (matchesByStage[s]?.length ?? 0) > 0
  );
  const thirdPlaceMatches = matchesByStage["3rd"] ?? [];

  if (stagesWithMatches.length === 0 && thirdPlaceMatches.length === 0) return null;

  return (
    <section style={{ marginTop: 34 }}>
      <div className="sec-head" style={{ marginBottom: 12 }}>
        <h2>Knockout bracket</h2>
        <span className="tag-soft">Owner color = whose team it is</span>
      </div>
      <div className="card" style={{ padding: "18px 16px" }}>
        <div className="bracket">
          {stagesWithMatches.map((stage) => {
            const matches = matchesByStage[stage] ?? [];
            const isFinal = stage === "final";
            return (
              <div key={stage} className={`br-col ${COL_CLASS[stage] ?? ""}`}>
                <div className="ttl">{BRACKET_LABELS[stage]}</div>
                {matches.map((m) => (
                  <BrMatch key={m.id} m={m} />
                ))}
                {isFinal && (
                  <div style={{ textAlign: "center", marginTop: 14 }}>
                    <span className="badge gold" style={{ height: 30, fontSize: 14, padding: "0 16px" }}>
                      🏆 Champion
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {thirdPlaceMatches.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>3rd Place</div>
            <div style={{ maxWidth: 210 }}>
              {thirdPlaceMatches.map((m) => (
                <BrMatch key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
