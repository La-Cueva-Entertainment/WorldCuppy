import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { TEAMS } from "@/lib/teams";
import { buildDraftTiers } from "@/lib/draftTiers";

export type PlayerAnalysis = {
  userId: string;
  name: string;
  grade: string; // e.g. "A+", "B-", "C", "D+"
  summary: string; // 3-5 sentence funny roast/analysis
  strengths: string;
  weaknesses: string;
  picks: { teamCode: string; teamName: string; tier: number; rank: number; group: string }[];
};

export type DraftAnalysis = {
  headline: string; // bold one-liner
  storyline: string; // 2-3 paragraph narrative of how the draft went
  players: PlayerAnalysis[];
  draftMVP: string; // userId of the "winner" of the draft
  draftGoat: string; // userId of the biggest loser of the draft (GOAT = Greatest Of All Time... at losing)
  draftMVPName: string;
  draftGoatName: string;
  generatedAt: string; // ISO timestamp
};

const TEAMS_BY_CODE = new Map(TEAMS.map((t) => [t.code, t]));

function getTier(teamCode: string, tiers: ReturnType<typeof buildDraftTiers>): number {
  for (const tier of tiers) {
    if (tier.teams.some((t) => t.code === teamCode)) return tier.num;
  }
  return 4;
}

export async function generateDraftAnalysis(tournamentId: string): Promise<DraftAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const [tournament, allPicks, participants, allUsers] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, year: true, teamsPerPlayer: true },
    }),
    prisma.lineupPick.findMany({
      where: { tournamentId },
      orderBy: [{ pickNumber: "asc" }, { createdAt: "asc" }],
      select: { userId: true, teamCode: true, pickNumber: true },
    }),
    prisma.tournamentParticipant.findMany({
      where: { tournamentId },
      select: { userId: true, teamName: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);

  if (!tournament) throw new Error("Tournament not found");

  const draft = await prisma.tournamentDraft.findUnique({
    where: { tournamentId },
    select: { orderUserIds: true },
  });

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const teamNameById = new Map(participants.filter((p) => p.teamName).map((p) => [p.userId, p.teamName!]));
  const tiers = buildDraftTiers(tournamentId);

  function displayName(uid: string): string {
    if (teamNameById.has(uid)) return teamNameById.get(uid)!;
    const u = userById.get(uid);
    return u?.name ?? u?.email?.split("@")[0] ?? "Unknown";
  }

  const orderUserIds = (draft?.orderUserIds as string[] | null) ?? [];
  const picksByUser = new Map<string, typeof allPicks>();
  for (const pick of allPicks) {
    const arr = picksByUser.get(pick.userId) ?? [];
    arr.push(pick);
    picksByUser.set(pick.userId, arr);
  }

  // Build player summaries for the prompt
  const playerSummaries = orderUserIds.map((uid, draftPosition) => {
    const picks = picksByUser.get(uid) ?? [];
    const pickDetails = picks.map((p) => {
      const team = TEAMS_BY_CODE.get(p.teamCode);
      const tier = getTier(p.teamCode, tiers);
      return {
        teamCode: p.teamCode,
        teamName: team?.name ?? p.teamCode,
        tier,
        rank: team?.rank ?? 99,
        group: team?.group ?? "?",
        pickNumber: p.pickNumber,
      };
    });

    const avgRank = pickDetails.length
      ? (pickDetails.reduce((s, p) => s + p.rank, 0) / pickDetails.length).toFixed(1)
      : "N/A";
    const groups = [...new Set(pickDetails.map((p) => p.group))].join(", ");
    const tierCounts = [1, 2, 3, 4].map((t) => pickDetails.filter((p) => p.tier === t).length);

    return {
      uid,
      draftPosition: draftPosition + 1,
      name: displayName(uid),
      picks: pickDetails,
      avgRank,
      groups,
      tierCounts,
    };
  });

  const prompt = `You are a hilarious, brutally honest, and slightly chaotic fantasy football (soccer) analyst covering the ${tournament.name} ${tournament.year} World Cup draft. Your audience is a group of friends — adults who can handle trash talk, sarcasm, and edgy humor. Be funny, be savage, be real.

Here is the draft data:

Tournament: ${tournament.name} ${tournament.year}
Teams per player: ${tournament.teamsPerPlayer}
Draft format: Snake draft (1st pick is last pick in round 2, etc.)
Total teams: ${TEAMS.length}

Tier system:
- Tier 1 (Contenders): FIFA rank ~1-12, the heavy favorites
- Tier 2 (Dark Horses): FIFA rank ~13-24, solid but not favorites
- Tier 3 (Mid Pack): FIFA rank ~25-36, could surprise you
- Tier 4 (Long Shots): FIFA rank ~37+, pray for miracles

Players and their picks (in draft order):
${playerSummaries
  .map(
    (p) => `
Player: ${p.name} (draft position #${p.draftPosition})
  Picks: ${p.picks.map((pk) => `${pk.teamName} (Tier ${pk.tier}, FIFA #${pk.rank}, Group ${pk.group})`).join(", ")}
  Average team FIFA rank: ${p.avgRank}
  Groups covered: ${p.groups}
  Tier breakdown: T1:${p.tierCounts[0]} T2:${p.tierCounts[1]} T3:${p.tierCounts[2]} T4:${p.tierCounts[3]}`
  )
  .join("\n")}

Key context for your analysis:
- Having multiple teams in the same group is risky — they can knock each other out early
- A low average FIFA rank (e.g. 5) means you have elite teams. A high average (e.g. 45) means you gambled on chaos
- The snake draft means pick #1 waits the longest for their next pick — mid-round picks are often the sweet spot
- Tier 1 teams are safe but boring. Full Tier 4 rosters are either genius or brain damage
- Group diversity means your teams stay alive longer even if one goes out early

Please respond with ONLY valid JSON (no markdown, no code fences) in exactly this structure:
{
  "headline": "one punchy headline about the overall draft (max 12 words)",
  "storyline": "2-3 paragraphs of narrative about how the draft went, the drama, the winners, the disasters",
  "players": [
    {
      "userId": "<uid>",
      "name": "<name>",
      "grade": "<letter grade A+ to F>",
      "summary": "3-5 sentences. Roast their picks. Mention specific teams and why their choices were great, tragic, or both. Be funny and specific.",
      "strengths": "1-2 sentences on what they got right",
      "weaknesses": "1-2 sentences on where they screwed up or got lucky/unlucky"
    }
  ],
  "draftMVP": "<userId of the player who won the draft>",
  "draftGoat": "<userId of the player who lost hardest in the draft>",
  "draftMVPName": "<name of the MVP>",
  "draftGoatName": "<name of the GOAT>"
}

Make it entertaining. Don't be generic. Reference specific teams and picks. The friends will read these to each other so make it memorable.`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: Omit<DraftAnalysis, "generatedAt">;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Sometimes Claude wraps in code fences despite instructions — strip them
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  }

  // Attach the enriched picks data to each player for display
  const analysis: DraftAnalysis = {
    ...parsed,
    players: parsed.players.map((p) => {
      const summary = playerSummaries.find((ps) => ps.uid === p.userId);
      return {
        ...p,
        picks:
          summary?.picks.map((pk) => ({
            teamCode: pk.teamCode,
            teamName: pk.teamName,
            tier: pk.tier,
            rank: pk.rank,
            group: pk.group,
          })) ?? [],
      };
    }),
    generatedAt: new Date().toISOString(),
  };

  // Persist to DB
  await prisma.tournamentDraft.update({
    where: { tournamentId },
    data: { analysis: analysis as object },
  });

  return analysis;
}

export async function getDraftAnalysis(tournamentId: string): Promise<DraftAnalysis | null> {
  const draft = await prisma.tournamentDraft.findUnique({
    where: { tournamentId },
    select: { analysis: true },
  });
  if (!draft?.analysis) return null;
  return draft.analysis as DraftAnalysis;
}
