export const FINISHER_MIN_POINTS = 300;
export const FINISHER_MAX_POINTS = 1000;
export const NON_FINISHER_MAX_POINTS = 200;

export function computeFinisherPoints(yourTimeSeconds: number, fastestTimeSeconds: number): number {
  if (yourTimeSeconds <= 0) throw new Error("yourTimeSeconds must be positive");
  if (fastestTimeSeconds <= 0) throw new Error("fastestTimeSeconds must be positive");
  const raw = Math.round((FINISHER_MAX_POINTS * fastestTimeSeconds) / yourTimeSeconds);
  return Math.min(FINISHER_MAX_POINTS, Math.max(FINISHER_MIN_POINTS, raw));
}

export function computeNonFinisherPoints(rowsSolved: number, totalRows: number): number {
  if (totalRows <= 0) throw new Error("totalRows must be positive");
  const raw = Math.round((NON_FINISHER_MAX_POINTS * rowsSolved) / totalRows);
  return Math.max(0, raw);
}
