import { useEffect, useState } from "react";
import {
  applyHint,
  createChainState,
  isComplete,
  submitGuess,
  toPublicBoardView,
  toPublicRows,
  type Puzzle,
} from "@wordchain/shared";
import { ChainBoard } from "../components/ChainBoard.js";
import { isSoundEnabled, playTone, setSoundEnabled } from "../sound.js";
import { usePenaltyFlashes } from "../usePenaltyFlashes.js";

export interface SoloRunSummary {
  puzzle: Puzzle;
  rawTimeSeconds: number;
  wrongGuesses: number;
  hintsUsed: number;
  rowsSolved: number;
  totalRows: number;
}

export interface SoloRoundPageProps {
  puzzle: Puzzle;
  onFinished: (summary: SoloRunSummary) => void;
  onQuit: () => void;
}

export function SoloRoundPage({ puzzle, onFinished, onQuit }: SoloRoundPageProps) {
  const [chainState, setChainState] = useState(() => createChainState(puzzle.words));
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const rows = toPublicRows(puzzle.words);
  const boardView = toPublicBoardView(chainState);
  const totalRows = puzzle.words.length - 2;
  const penaltyFlashes = usePenaltyFlashes(boardView.penaltySeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  function handleSubmitGuess(rowIndex: number, guess: string) {
    const result = submitGuess(chainState, rowIndex, guess);
    setChainState(result.state);
    playTone(result.correct ? "correct" : "wrong");

    if (!result.correct) {
      setWrongGuesses((w) => w + 1);
      return;
    }

    if (isComplete(result.state)) {
      playTone("complete");
      const finishedAt = Date.now();
      onFinished({
        puzzle,
        rawTimeSeconds: (finishedAt - startedAt) / 1000 + result.state.penaltySeconds,
        wrongGuesses,
        hintsUsed,
        rowsSolved: totalRows,
        totalRows,
      });
    }
  }

  function handleHint(rowIndex: number) {
    const next = applyHint(chainState, rowIndex);
    setChainState(next);
    setHintsUsed((h) => h + 1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-3 sm:p-6 flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-md text-white font-display font-bold">
        <span className="uppercase tracking-widest text-sm opacity-90">{puzzle.category}</span>
        <span className="relative font-mono tabular-nums">
          {elapsedSeconds + boardView.penaltySeconds}s
          {penaltyFlashes.map((flash) => (
            <span
              key={flash.id}
              className="absolute left-1/2 -top-1 -translate-x-1/2 text-red-300 text-xs font-bold animate-penalty-float pointer-events-none"
            >
              +{flash.amount}s
            </span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !soundOn;
            setSoundEnabled(next);
            setSoundOn(next);
          }}
          className="text-xl"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
      </div>

      <div className="w-full max-w-md flex justify-start">
        <ChainBoard rows={rows} boardView={boardView} onSubmitGuess={handleSubmitGuess} onHint={handleHint} />
      </div>

      <button type="button" onClick={onQuit} className="text-white/70 text-sm font-semibold underline mt-4">
        Give up
      </button>
    </div>
  );
}
