import { HINT_PENALTY_SECONDS, WRONG_GUESS_PENALTY_SECONDS } from "@wordchain/shared";
import type { SoloRunSummary } from "./SoloRoundPage.js";
import { Button } from "../components/Button.js";

export interface SoloResultsPageProps {
  summary: SoloRunSummary;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export function SoloResultsPage({ summary, onPlayAgain, onBackToMenu }: SoloResultsPageProps) {
  const wrongGuessPenalty = summary.wrongGuesses * WRONG_GUESS_PENALTY_SECONDS;
  const hintPenalty = summary.hintsUsed * HINT_PENALTY_SECONDS;
  const solveTimeSeconds = summary.rawTimeSeconds - wrongGuessPenalty - hintPenalty;

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <h1 className="font-display text-3xl text-white font-extrabold uppercase tracking-wide">🎉 Solved!</h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="font-body text-chain-locked/70">Final time</span>
          <span className="font-mono font-bold text-chain-purple text-2xl tabular-nums">
            {summary.rawTimeSeconds.toFixed(1)}s
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-body text-chain-locked/70">Solve time</span>
          <span className="font-mono text-chain-locked tabular-nums">{solveTimeSeconds.toFixed(1)}s</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-body text-chain-locked/70">Wrong guesses</span>
          <span className="font-mono text-chain-locked tabular-nums">
            {summary.wrongGuesses} (+{wrongGuessPenalty}s)
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-body text-chain-locked/70">Hints used</span>
          <span className="font-mono text-chain-locked tabular-nums">
            {summary.hintsUsed} (+{hintPenalty}s)
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onPlayAgain}>Play Again</Button>
        <Button variant="secondary" onClick={onBackToMenu}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
}
