import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { RoundResult, RoundStartedPayload } from "@wordchain/shared";
import { getSocket } from "../socket.js";

export interface ResultsPageProps {
  results: RoundResult[];
  totals: Record<string, number>;
  role: "host" | "player";
  isLastRound: boolean;
  onAdvance?: () => void;
  onNextRoundStarted?: (payload: RoundStartedPayload) => void;
}

export function ResultsPage({ results, totals, role, isLastRound, onAdvance, onNextRoundStarted }: ResultsPageProps) {
  useEffect(() => {
    if (role !== "player" || !onNextRoundStarted) return;
    const socket = getSocket();
    socket.on("round:started", onNextRoundStarted);
    return () => {
      socket.off("round:started");
    };
  }, [role, onNextRoundStarted]);

  useEffect(() => {
    if (isLastRound) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }
  }, [isLastRound]);

  const leaderboard = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([entrantId, total]) => ({
      entrantId,
      total,
      displayName: results.find((r) => r.entrantId === entrantId)?.displayName ?? entrantId,
    }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-6 flex flex-col items-center gap-6">
      <h1 className="font-display text-3xl text-white font-extrabold">
        {isLastRound ? "Final Results 🏆" : "Round Results"}
      </h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-2">
        {leaderboard.map((entry, index) => (
          <div key={entry.entrantId} className="flex items-center justify-between">
            <span className="font-display font-bold text-chain-locked">
              {index + 1}. {entry.displayName}
            </span>
            <span className="font-display font-extrabold text-chain-purple">{entry.total} pts</span>
          </div>
        ))}
      </div>

      {role === "host" && (
        <button
          type="button"
          onClick={onAdvance}
          className="bg-chain-yellow shadow-[0_4px_0_#e0b800] rounded-full px-8 py-3 font-display font-extrabold text-chain-locked"
        >
          {isLastRound ? "End Session" : "Next Round"}
        </button>
      )}
    </div>
  );
}
