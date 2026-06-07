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

const TIER_META = [
  { key: "tier1", num: 1, name: "Contenders",  jump: "base",       rangeDesc: "FIFA #1–12" },
  { key: "tier2", num: 2, name: "Dark horses",  jump: "+$1 / jump", rangeDesc: "FIFA #13–24" },
  { key: "tier3", num: 3, name: "Mid pack",     jump: "+$2 / jump", rangeDesc: "FIFA #25–36" },
  { key: "tier4", num: 4, name: "Long shots",   jump: "+$3 / jump", rangeDesc: "FIFA #37+" },
] as const;

export function buildDraftTiers(tournamentId: string) {
  const sorted = TEAMS.slice().sort((a, b) => a.rank - b.rank);
  const chunkSize = Math.ceil(sorted.length / 4);
  return TIER_META.map((meta, ti) => {
    const chunk = sorted.slice(ti * chunkSize, (ti + 1) * chunkSize);
    const shuffled = seededShuffle(chunk, tournamentId + ti);
    return {
      key: meta.key,
      num: meta.num,
      labelBase: meta.name,
      label: meta.name,
      jump: meta.jump,
      rangeLabel: chunk.length > 0
        ? `Rank ${chunk[0]!.rank}–${chunk[chunk.length - 1]!.rank}`
        : meta.rangeDesc,
      teams: shuffled.map((t) => ({ code: t.code, name: t.name, rank: t.rank })),
    };
  });
}
