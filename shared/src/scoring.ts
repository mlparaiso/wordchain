export const FINISHER_MIN_POINTS = 300;
export const FINISHER_MAX_POINTS = 1000;
export const NON_FINISHER_MAX_POINTS = 200;

export function computeFinisherPoints(yourTimeSeconds: number, fastestTimeSeconds: number): number {
  // A chain's last blank can be short enough to auto-complete within milliseconds of
  // round start (see createChainState's free starting-hint reveal), so a ~0s finish is a
  // real, reachable result — not just bad input. Treat it as the fastest possible finish
  // rather than throwing, since an uncaught exception here would crash the whole server
  // (endRound has no way to recover a round once scoring fails partway through).
  if (yourTimeSeconds <= 0) return FINISHER_MAX_POINTS;
  const raw = Math.round((FINISHER_MAX_POINTS * fastestTimeSeconds) / yourTimeSeconds);
  return Math.min(FINISHER_MAX_POINTS, Math.max(FINISHER_MIN_POINTS, raw));
}

export function computeNonFinisherPoints(rowsSolved: number, totalRows: number): number {
  if (totalRows <= 0) throw new Error("totalRows must be positive");
  const raw = Math.round((NON_FINISHER_MAX_POINTS * rowsSolved) / totalRows);
  return Math.max(0, raw);
}
