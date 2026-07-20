import type { Server } from "socket.io";
import { computeFinisherPoints, computeNonFinisherPoints, type RoundResult } from "@wordchain/shared";
import type { Room } from "./Room.js";

export function computeRoundResults(room: Room): RoundResult[] {
  const round = room.currentRound;
  if (!round) throw new Error("No active round to score");

  const totalBlanks = round.puzzle.words.length - 2;
  const rawTimes = new Map<string, number>();
  for (const [entrantId, finishedAtMs] of round.finishedAt.entries()) {
    const chainState = round.entrantChains.get(entrantId)!;
    const elapsedSeconds = (finishedAtMs - round.startedAt) / 1000;
    rawTimes.set(entrantId, elapsedSeconds + chainState.penaltySeconds);
  }
  const fastestTime = rawTimes.size > 0 ? Math.min(...rawTimes.values()) : null;

  return [...round.entrantChains.keys()].map((entrantId) => {
    const chainState = round.entrantChains.get(entrantId)!;
    const displayName = room.getDisplayName(entrantId);

    if (rawTimes.has(entrantId)) {
      const rawTimeSeconds = rawTimes.get(entrantId)!;
      return {
        entrantId,
        displayName,
        finished: true,
        rowsSolved: totalBlanks,
        totalRows: totalBlanks,
        rawTimeSeconds,
        points: computeFinisherPoints(rawTimeSeconds, fastestTime!),
      };
    }

    const blanksSolved = chainState.topSolved + (round.puzzle.words.length - 1 - chainState.bottomSolved);
    return {
      entrantId,
      displayName,
      finished: false,
      rowsSolved: blanksSolved,
      totalRows: totalBlanks,
      rawTimeSeconds: null,
      points: computeNonFinisherPoints(blanksSolved, totalBlanks),
    };
  });
}

export function endRound(io: Server, room: Room): void {
  if (!room.currentRound) return; // already ended (manual end raced with the auto-timer)

  if (room.currentRound.timeoutHandle) clearTimeout(room.currentRound.timeoutHandle);

  const results = computeRoundResults(room);
  for (const result of results) {
    const previous = room.totalPoints.get(result.entrantId) ?? 0;
    room.totalPoints.set(result.entrantId, previous + result.points);
  }

  io.to(room.code).emit("round:results", {
    results,
    totals: Object.fromEntries(room.totalPoints),
  });

  room.currentRound = null;
}
