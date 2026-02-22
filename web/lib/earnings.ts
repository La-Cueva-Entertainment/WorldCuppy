export type EarningsStageKey =
  | "group_w1"
  | "group_w2"
  | "group_w3"
  | "r32"
  | "r16";

export type UserStagePoints = Record<EarningsStageKey, number> & {
  overallPoints: number;
};

type PayoutLine = {
  userId: string;
  cents: number;
};

function clampNonNegativeInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function distributeProRataCents(
  poolCents: number,
  pointsByUser: Array<{ userId: string; points: number }>,
): PayoutLine[] {
  const pool = clampNonNegativeInt(poolCents);
  if (pool === 0) return pointsByUser.map((p) => ({ userId: p.userId, cents: 0 }));

  const totalPoints = pointsByUser.reduce(
    (sum, p) => sum + clampNonNegativeInt(p.points),
    0,
  );
  if (totalPoints <= 0) {
    return pointsByUser.map((p) => ({ userId: p.userId, cents: 0 }));
  }

  const raw = pointsByUser.map((p) => {
    const pts = clampNonNegativeInt(p.points);
    const exact = (pool * pts) / totalPoints;
    const floor = Math.floor(exact);
    return {
      userId: p.userId,
      floor,
      frac: exact - floor,
    };
  });

  let paid = raw.reduce((sum, r) => sum + r.floor, 0);
  let remainder = pool - paid;

  raw.sort((a, b) => b.frac - a.frac || a.userId.localeCompare(b.userId));
  for (let i = 0; i < raw.length && remainder > 0; i += 1) {
    raw[i].floor += 1;
    remainder -= 1;
  }

  const out = raw.map((r) => ({ userId: r.userId, cents: r.floor }));
  out.sort((a, b) => a.userId.localeCompare(b.userId));
  return out;
}

function splitEvenlyCents(poolCents: number, userIds: string[]): PayoutLine[] {
  const pool = clampNonNegativeInt(poolCents);
  if (!userIds.length) return [];

  const base = Math.floor(pool / userIds.length);
  let remainder = pool - base * userIds.length;

  const sorted = userIds.slice().sort();
  return sorted.map((userId, idx) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { userId, cents: base + extra };
  });
}

export function calculateLeagueEarnings({
  buyInCents,
  memberUserIds,
  pointsByUserId,
}: {
  buyInCents: number;
  memberUserIds: string[];
  pointsByUserId: Record<string, UserStagePoints>;
}) {
  const buyIn = clampNonNegativeInt(buyInCents);
  const members = memberUserIds.slice();

  const totalPot = buyIn * members.length;
  const groupPool = Math.floor(totalPot * 0.25);
  const r32Pool = Math.floor(totalPot * 0.15);
  const r16Pool = Math.floor(totalPot * 0.1);
  const remainingPool = totalPot - groupPool - r32Pool - r16Pool;

  const w1Pool = Math.floor(groupPool / 3);
  const w2Pool = Math.floor(groupPool / 3);
  const w3Pool = groupPool - w1Pool - w2Pool;

  const stagePools: Array<{ stage: EarningsStageKey; pool: number }> = [
    { stage: "group_w1", pool: w1Pool },
    { stage: "group_w2", pool: w2Pool },
    { stage: "group_w3", pool: w3Pool },
    { stage: "r32", pool: r32Pool },
    { stage: "r16", pool: r16Pool },
  ];

  const earnedByUser: Record<string, number> = {};
  for (const userId of members) earnedByUser[userId] = 0;

  const earnedByUserByStage: Record<EarningsStageKey, Record<string, number>> = {
    group_w1: {},
    group_w2: {},
    group_w3: {},
    r32: {},
    r16: {},
  };
  for (const stage of Object.keys(earnedByUserByStage) as EarningsStageKey[]) {
    for (const userId of members) earnedByUserByStage[stage][userId] = 0;
  }

  for (const { stage, pool } of stagePools) {
    const pointsRows = members.map((userId) => ({
      userId,
      points: pointsByUserId[userId]?.[stage] ?? 0,
    }));

    const payouts = distributeProRataCents(pool, pointsRows);
    for (const p of payouts) {
      earnedByUser[p.userId] = (earnedByUser[p.userId] ?? 0) + p.cents;
      earnedByUserByStage[stage][p.userId] =
        (earnedByUserByStage[stage][p.userId] ?? 0) + p.cents;
    }
  }

  // Remaining pool: 1st gets 80%, 2nd gets 20% (ties split).
  const overall = members.map((userId) => ({
    userId,
    points: pointsByUserId[userId]?.overallPoints ?? 0,
  }));
  const maxPoints = Math.max(0, ...overall.map((o) => clampNonNegativeInt(o.points)));
  const firstGroup = overall
    .filter((o) => clampNonNegativeInt(o.points) === maxPoints)
    .map((o) => o.userId);

  if (firstGroup.length > 1) {
    const payouts = splitEvenlyCents(remainingPool, firstGroup);
    for (const p of payouts) earnedByUser[p.userId] = (earnedByUser[p.userId] ?? 0) + p.cents;
  } else {
    const winnerId = firstGroup[0] ?? null;
    const others = overall.filter((o) => o.userId !== winnerId);
    const secondPoints = Math.max(0, ...others.map((o) => clampNonNegativeInt(o.points)));
    const secondGroup = others
      .filter((o) => clampNonNegativeInt(o.points) === secondPoints)
      .map((o) => o.userId);

    const secondPool = Math.floor(remainingPool * 0.2);
    const firstPool = remainingPool - secondPool;

    if (winnerId) earnedByUser[winnerId] = (earnedByUser[winnerId] ?? 0) + firstPool;

    const secondPayouts = splitEvenlyCents(secondPool, secondGroup);
    for (const p of secondPayouts) earnedByUser[p.userId] = (earnedByUser[p.userId] ?? 0) + p.cents;
  }

  const earnedByUserRemaining: Record<string, number> = {};
  for (const userId of members) {
    const staged = (Object.keys(earnedByUserByStage) as EarningsStageKey[]).reduce(
      (sum, sk) => sum + (earnedByUserByStage[sk][userId] ?? 0),
      0,
    );
    earnedByUserRemaining[userId] = (earnedByUser[userId] ?? 0) - staged;
  }

  return {
    totalPotCents: totalPot,
    poolsCents: {
      groupStage: groupPool,
      group_w1: w1Pool,
      group_w2: w2Pool,
      group_w3: w3Pool,
      r32: r32Pool,
      r16: r16Pool,
      remaining: remainingPool,
    },
    earnedByUserCents: earnedByUser,
    earnedByUserByStageCents: earnedByUserByStage,
    earnedByUserRemainingCents: earnedByUserRemaining,
  };
}
