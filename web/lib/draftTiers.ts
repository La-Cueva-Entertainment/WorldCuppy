import { TEAMS } from "@/lib/teams";

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = Array.from(seed).reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0) >>> 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildDraftTiers(tournamentId: string) {
  const sorted = TEAMS.slice().sort((a, b) => a.rank - b.rank);
  const chunkSize = Math.ceil(sorted.length / 4);
  return [0, 1, 2, 3].map((ti) => {
    const chunk = sorted.slice(ti * chunkSize, (ti + 1) * chunkSize);
    const shuffled = seededShuffle(chunk, tournamentId + ti);
    return {
      key: `tier${ti + 1}`,
      labelBase: `Tier ${ti + 1}`,
      label: `Tier ${ti + 1}`,
      rangeLabel: `Rank ${chunk[0]?.rank ?? 0}–${chunk[chunk.length - 1]?.rank ?? 0}`,
      teams: shuffled.map((t) => ({ code: t.code, name: t.name, rank: t.rank })),
    };
  });
}
