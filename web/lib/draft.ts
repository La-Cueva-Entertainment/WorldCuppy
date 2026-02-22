import "server-only";

export function getSnakeTurnUserId(orderUserIds: string[], pickNumber: number) {
  const n = orderUserIds.length;
  if (n <= 0) return null;

  const pickInRound = pickNumber % n;
  const roundIndex = Math.floor(pickNumber / n);
  const forward = roundIndex % 2 === 0;
  const idx = forward ? pickInRound : n - 1 - pickInRound;
  return orderUserIds[idx] ?? null;
}
