import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import type { RoundResult, RoundStartedPayload } from "@wordchain/shared";
import { getSocket } from "../socket.js";
import { useCountUp } from "../useCountUp.js";
import { Button } from "../components/Button.js";

export interface ResultsPageProps {
  results: RoundResult[];
  totals: Record<string, number>;
  role: "host" | "player";
  isLastRound: boolean;
  onAdvance?: () => void;
  onNextRoundStarted?: (payload: RoundStartedPayload) => void;
}

const MEDAL_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function LeaderboardRow({ rank, displayName, total }: { rank: number; displayName: string; total: number }) {
  const animatedTotal = useCountUp(total);
  const isPodium = rank <= 3;
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
        isPodium ? "bg-chain-yellow/15 shadow-[0_2px_0_rgba(224,184,0,0.25)]" : ""
      }`}
    >
      <span className="font-display font-bold text-chain-locked flex items-center gap-2">
        <span className={isPodium ? "text-xl" : "w-5 text-center text-chain-locked/60"}>
          {MEDAL_EMOJI[rank] ?? `${rank}.`}
        </span>
        {displayName}
      </span>
      <span className="font-mono font-bold text-chain-purple tabular-nums">{animatedTotal} pts</span>
    </div>
  );
}

export function ResultsPage({ results, totals, role, isLastRound, onAdvance, onNextRoundStarted }: ResultsPageProps) {
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (role !== "player" || !onNextRoundStarted) return;
    const socket = getSocket();
    socket.on("round:started", onNextRoundStarted);
    return () => {
      socket.off("round:started", onNextRoundStarted);
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
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-4 sm:p-6 flex flex-col items-center gap-6">
      <h1 className="font-display text-3xl text-white font-extrabold">
        {isLastRound ? "Final Results 🏆" : "Round Results"}
      </h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-2">
        {leaderboard.map((entry, index) => (
          <LeaderboardRow key={entry.entrantId} rank={index + 1} displayName={entry.displayName} total={entry.total} />
        ))}
      </div>

      {role === "host" && (
        <Button
          disabled={advancing}
          onClick={() => {
            if (advancing) return;
            setAdvancing(true);
            onAdvance?.();
          }}
        >
          {isLastRound ? "End Session" : "Next Round"}
        </Button>
      )}
    </div>
  );
}
